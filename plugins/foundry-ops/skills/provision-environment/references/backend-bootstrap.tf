# State backend bootstrap.
#
# Chicken and egg: the backend cannot live in the state it stores. Resolve it once,
# deliberately:
#   1. apply this root module with LOCAL state
#   2. add the backend block below and `terraform init -migrate-state`
#   3. commit the resulting state file? NO - verify it moved, then delete the local
#      file and confirm `git log --all -- '*.tfstate'` is empty
#
# State contains SECRETS IN PLAINTEXT: generated passwords, private keys, anything a
# resource returns. Everything here follows from that fact.
#
# Resolve every <PLACEHOLDER>. Never write a version, ARN or key id from memory.

terraform {
  required_version = ">= <MIN-VERSION>"        # from `terraform version`
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> <MAJOR>.<MINOR>"           # check the registry; do not guess
    }
  }
}

# ---------------------------------------------------------------------------
# Encryption key. A customer-managed key, not the provider default: it gives you
# an access policy, an audit trail and the ability to revoke.
# ---------------------------------------------------------------------------
resource "aws_kms_key" "state" {
  description             = "Terraform state encryption - <ENV>"
  enable_key_rotation     = true
  deletion_window_in_days = 30      # a deleted key makes the state unrecoverable
  tags                    = local.common_tags

  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_kms_alias" "state" {
  name          = "alias/<ORG>-<ENV>-tfstate"
  target_key_id = aws_kms_key.state.key_id
}

# ---------------------------------------------------------------------------
# State bucket.
# ---------------------------------------------------------------------------
resource "aws_s3_bucket" "state" {
  bucket = "<ORG>-<ENV>-tfstate-<UNIQUE-SUFFIX>"
  tags   = local.common_tags

  lifecycle {
    # Deleting this bucket means adopting every resource in the estate by hand.
    prevent_destroy = true
  }
}

# Versioning is not optional: state corruption is recoverable ONLY from a
# previous object version. This is the single most valuable line in this file.
resource "aws_s3_bucket_versioning" "state" {
  bucket = aws_s3_bucket.state.id
  versioning_configuration { status = "Enabled" }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "state" {
  bucket = aws_s3_bucket.state.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = aws_kms_key.state.arn
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_public_access_block" "state" {
  bucket                  = aws_s3_bucket.state.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Who touched state, and when. During an incident this is the difference between
# a theory and an answer.
resource "aws_s3_bucket_logging" "state" {
  bucket        = aws_s3_bucket.state.id
  target_bucket = "<AUDIT-LOG-BUCKET>"
  target_prefix = "tfstate/<ENV>/"
}

# Old state versions accumulate. Keep enough to recover, not forever - each one
# is a copy of your secrets.
resource "aws_s3_bucket_lifecycle_configuration" "state" {
  bucket = aws_s3_bucket.state.id
  rule {
    id     = "expire-noncurrent"
    status = "Enabled"
    filter {}
    noncurrent_version_expiration { noncurrent_days = <RETENTION-DAYS> }
  }
}

# Deny any unencrypted or non-TLS access at the bucket policy level, so a
# misconfigured client fails loudly instead of writing plaintext.
resource "aws_s3_bucket_policy" "state" {
  bucket = aws_s3_bucket.state.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "DenyInsecureTransport"
        Effect    = "Deny"
        Principal = "*"
        Action    = "s3:*"
        Resource  = [aws_s3_bucket.state.arn, "${aws_s3_bucket.state.arn}/*"]
        Condition = { Bool = { "aws:SecureTransport" = "false" } }
      }
    ]
  })
}

# ---------------------------------------------------------------------------
# Locking.
# Newer Terraform/OpenTofu versions support S3-native state locking via a
# lockfile object; older ones require a DynamoDB table. Check which your pinned
# version supports and keep exactly ONE mechanism - running both is confusing
# and running neither is how two applies race and corrupt state.
# ---------------------------------------------------------------------------
resource "aws_dynamodb_table" "lock" {
  name         = "<ORG>-<ENV>-tfstate-lock"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "LockID"           # exactly this name; the backend requires it

  attribute {
    name = "LockID"
    type = "S"
  }

  point_in_time_recovery { enabled = true }
  server_side_encryption {
    enabled     = true
    kms_key_arn = aws_kms_key.state.arn
  }
  tags = local.common_tags

  lifecycle {
    prevent_destroy = true
  }
}

# ---------------------------------------------------------------------------
# The backend block, added at step 2 above. Values come from -backend-config so
# the same code serves every environment without a copied file.
# ---------------------------------------------------------------------------
# terraform {
#   backend "s3" {
#     encrypt = true
#     # bucket, key, region, kms_key_id, dynamodb_table (or use_lockfile)
#     # supplied via: terraform init -backend-config=<env>.backend.hcl
#   }
# }

# ---------------------------------------------------------------------------
# <env>.backend.hcl  (not secret, but environment-specific - commit it)
# ---------------------------------------------------------------------------
#   bucket         = "<ORG>-<ENV>-tfstate-<UNIQUE-SUFFIX>"
#   key            = "<ENV>/<LAYER>/terraform.tfstate"
#   region         = "<REGION>"
#   kms_key_id     = "<KMS-KEY-ARN>"
#   dynamodb_table = "<ORG>-<ENV>-tfstate-lock"
#   encrypt        = true

# ---------------------------------------------------------------------------
# VERIFY LOCKING BEFORE TRUSTING IT. A backend you believe locks is not a
# backend that locks.
#
#   terraform init -backend-config=<env>.backend.hcl
#   terraform plan &        # start one
#   terraform plan          # this must block or fail on the lock
#
# Stuck lock after a cancelled CI job:
#   terraform force-unlock <LOCK-ID>
# ONLY after confirming no apply is still running. Force-unlocking a live apply
# corrupts state.
#
# Azure equivalent: storage account + container, blob lease locking (automatic),
#   infrastructure encryption, soft delete and versioning enabled.
# GCP equivalent: GCS bucket, object generation locking (automatic),
#   CMEK via kms_key_name, object versioning enabled.
# The requirements are identical: encrypted, versioned, logged, locked, restricted.
