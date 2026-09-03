#!/usr/bin/env node
/**
 * Repository convenience wrapper.
 *
 * The real implementation ships inside the foundry-core plugin, so that anyone who
 * installs the plugin from the marketplace gets it too — a script that only exists
 * in this repository would be a dangling reference for every other user.
 */
import './../plugins/foundry-core/scripts/fanout.mjs';
