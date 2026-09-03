# GitHub Actions -> cloud, without any long-lived key.
#
# The workflow side is three lines (permissions: id-token: write, plus a login
# action). THE SECURITY IS ENTIRELY IN THE TRUST POLICY BELOW.
#
# The `sub` claim is the control:
#   repo:<ORG>/<REPO>:environment:<ENV>          strongest - combine with required reviewers
#   repo:<ORG>/<REPO>:ref:refs/heads/<BRANCH>    acceptable for build/publish
#   repo:<ORG>/<REPO>:ref:refs/tags/v*           acceptable if tags are protected
#   repo:<ORG>/<REPO>:pull_request               read-only plan lane only
#   repo:<ORG>/<REPO>:*                          A FINDING, NOT A CONFIGURATION
#
# Resolve every <PLACEHOLDER>. Never write an ARN, resource name or thumbprint
# from memory - retrieve it with the commands at the bottom of this file.

# ===========================================================================
# AWS
# ===========================================================================

# One OIDC provider per account. Check whether one already exists before
# creating a second - duplicates cause confusing trust failures.
#   aws iam list-open-id-connect-providers
resource "aws_iam_openid_connect_provider" "github" {
  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  # Thumbprints: retrieve the current value rather than copying one from a blog
  # post. Some regions/configurations no longer require it; check the provider
  # documentation for your pinned version.
  thumbprint_list = ["<THUMBPRINT>"]
  tags            = local.common_tags
}

# --- APPLY role: environment-scoped, used only by the gated deploy job -----
resource "aws_iam_role" "gha_deploy" {
  name                 = "<ORG>-<ENV>-gha-deploy"
  max_session_duration = 3600
  tags                 = local.common_tags

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Federated = aws_iam_openid_connect_provider.github.arn }
      Action    = "sts:AssumeRoleWithWebIdentity"
      Condition = {
        StringEquals = {
          "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
          # EXACT match on the environment subject. StringEquals, not StringLike:
          # a wildcard here lets any branch and any fork-triggered run assume
          # this role, which defeats the entire mechanism.
          "token.actions.githubusercontent.com:sub" = "repo:<ORG>/<REPO>:environment:<ENV>"
        }
      }
    }]
  })
}

# Attach the narrowest policy that lets the deploy job do its job. Start from
# nothing and add what fails; never start from a managed admin policy with the
# intention of narrowing it later, because that never happens.
resource "aws_iam_role_policy" "gha_deploy" {
  name = "deploy"
  role = aws_iam_role.gha_deploy.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "<WHAT-THIS-ALLOWS-AND-WHY>"
        Effect   = "Allow"
        Action   = [<EXPLICIT-ACTIONS>]      # never "service:*", never "*"
        Resource = [<EXPLICIT-ARNS>]         # never "*"
      }
    ]
  })
}

# --- PLAN role: read-only, used by the pull_request lane ------------------
# Split plan from apply. The PR lane runs against untrusted contributor code:
# it must be able to read and plan, and must NOT be able to change anything.
resource "aws_iam_role" "gha_plan" {
  name                 = "<ORG>-<ENV>-gha-plan"
  max_session_duration = 3600
  tags                 = local.common_tags

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Federated = aws_iam_openid_connect_provider.github.arn }
      Action    = "sts:AssumeRoleWithWebIdentity"
      Condition = {
        StringEquals = {
          "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
          "token.actions.githubusercontent.com:sub" = "repo:<ORG>/<REPO>:pull_request"
        }
      }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "gha_plan_readonly" {
  role       = aws_iam_role.gha_plan.name
  policy_arn = "<READ-ONLY-POLICY-ARN>"     # aws iam list-policies --scope AWS
}

# The plan lane still needs to WRITE the state lock and READ state.
# Grant exactly that, and nothing else.
resource "aws_iam_role_policy" "gha_plan_state" {
  name = "state-access"
  role = aws_iam_role.gha_plan.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["s3:GetObject", "s3:ListBucket"]
        Resource = ["<STATE-BUCKET-ARN>", "<STATE-BUCKET-ARN>/*"]
      },
      {
        Effect   = "Allow"
        Action   = ["dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:DeleteItem"]
        Resource = ["<LOCK-TABLE-ARN>"]
      },
      {
        Effect   = "Allow"
        Action   = ["kms:Decrypt"]
        Resource = ["<STATE-KMS-KEY-ARN>"]
      }
    ]
  })
}

output "gha_deploy_role_arn" { value = aws_iam_role.gha_deploy.arn }
output "gha_plan_role_arn"   { value = aws_iam_role.gha_plan.arn }

# ===========================================================================
# Azure - shape only; the same subject rules apply
# ===========================================================================
#
# resource "azuread_application" "gha" { display_name = "<ORG>-<ENV>-gha" }
#
# resource "azuread_application_federated_identity_credential" "gha_deploy" {
#   application_id = azuread_application.gha.id
#   display_name   = "gha-<ENV>"
#   audiences      = ["<AUDIENCE>"]      # per Azure documentation
#   issuer         = "https://token.actions.githubusercontent.com"
#   subject        = "repo:<ORG>/<REPO>:environment:<ENV>"
# }
#
# Assign RBAC at the NARROWEST scope - a resource group, never the subscription:
# resource "azurerm_role_assignment" "gha_deploy" {
#   scope                = "<RESOURCE-GROUP-ID>"
#   role_definition_name = "<ROLE>"
#   principal_id         = "<SERVICE-PRINCIPAL-OBJECT-ID>"
# }
#
# The workflow passes client-id / tenant-id / subscription-id. None are secrets,
# though keeping them in repository variables is tidy.

# ===========================================================================
# GCP - shape only
# ===========================================================================
#
# resource "google_iam_workload_identity_pool" "github" {
#   workload_identity_pool_id = "<POOL-ID>"
# }
#
# resource "google_iam_workload_identity_pool_provider" "github" {
#   workload_identity_pool_id          = google_iam_workload_identity_pool.github.workload_identity_pool_id
#   workload_identity_pool_provider_id = "<PROVIDER-ID>"
#   oidc { issuer_uri = "https://token.actions.githubusercontent.com" }
#   attribute_mapping = {
#     "google.subject"       = "assertion.sub"
#     "attribute.repository" = "assertion.repository"
#     "attribute.environment"= "assertion.environment"
#   }
#   # WITHOUT an attribute_condition, ANY GitHub repository in the world can
#   # obtain a token for this pool. This line is mandatory, not optional.
#   attribute_condition = "assertion.repository == '<ORG>/<REPO>' && assertion.environment == '<ENV>'"
# }
#
# Then bind the pool principal to a service account with roles/iam.workloadIdentityUser.

# ===========================================================================
# Resolve the values - do not write identifiers from memory
# ===========================================================================
#
#   aws iam get-role --role-name <NAME> --query 'Role.Arn' --output text
#   aws iam list-open-id-connect-providers
#   az ad app federated-credential list --id <APP-ID>
#   gcloud iam workload-identity-pools providers describe <PROVIDER-ID> \
#     --location=global --workload-identity-pool=<POOL-ID>
#
# Confirm nothing static is left behind:
#   gh secret list --repo <OWNER>/<REPO>
#   gh api repos/<OWNER>/<REPO>/environments --jq '.environments[].name' \
#     | xargs -I{} gh secret list --env {} --repo <OWNER>/<REPO>
#
# Rotate any key-shaped value AT THE PROVIDER before deleting it from GitHub -
# deleting the secret does not invalidate the credential.
