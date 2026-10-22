# [F006][S002] Alice demo login help

User explicitly requested the Alice coach login hint, consistent with the existing demo help style. No authentication checks, roles or account grants are changed by this UI edit. Creating the coach login remains a separate authenticated admin action; the help entry alone is not account provisioning.

Validation: targeted login-help browser test passed using isolated API fixtures; TypeScript and production build passed (58 routes). Full/runtime npm audits report zero vulnerabilities. Credentials are omitted from this verification record.
