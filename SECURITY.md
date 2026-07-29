# Security Policy

## Reporting a Security Issue

We take the security of our products and Five North infrastructure seriously. No matter how much effort goes into building and reviewing these systems, vulnerabilities can still exist.

If you believe you have found a security vulnerability, please report it to us privately rather than disclosing it publicly. Use either of the following:

- Open a private report using GitHub's **Report a vulnerability** button on the Security tab of the affected repository
- Email **security@fivenorth.io**

Please do not open a public issue, pull request, or discussion describing a security vulnerability.

## What to Include

The more detail you can give us, the faster we can triage:

- A description of the issue and the impact you believe it has
- Steps to reproduce, or a proof of concept
- The affected component, version, and environment
- Any suggested remediation, if you have one

## What to Expect

- We aim to acknowledge your report within three business days
- We will confirm whether we can reproduce the issue and share our assessment of severity
- We will keep you updated as we work on a fix and let you know when it ships
- Where you would like to be named, we are glad to credit you publicly once the issue is resolved

## Scope

This policy covers:

- Loop Wallet, including the web application and its backend services
- Loop SDK
- USDC Bridge UI
- Public repositories under the `fivenorth-io` organization

The following are out of scope:

- Findings from automated scanners without a demonstrated, exploitable impact
- Denial of service through volumetric traffic
- Social engineering of Five North staff, contractors, or users
- Physical attacks against Five North property or personnel
- Vulnerabilities in third-party services we do not operate
- Missing best-practice headers or configuration hardening with no demonstrated impact

## Safe Harbor

We support good-faith security research. We will not pursue or support legal action against researchers who:

- Make a good-faith effort to avoid privacy violations, data destruction, and interruption of our services
- Interact only with accounts they own or have explicit permission to access
- Do not access, modify, or exfiltrate data belonging to other users
- Report the issue promptly and allow us reasonable time to respond before any public disclosure

If you are unsure whether a specific action falls within these terms, contact us at **security@fivenorth.io** before proceeding.

## Bounties

Five North does not currently operate a paid bug bounty program. We recognize responsible disclosure through public credit where the reporter wishes to be named.

## Security Audits

- Loop Wallet has been independently audited by Verified by Humans. A public summary of that audit, including the full list of findings and their remediation status, is available at [security-audits](https://github.com/fivenorth-io/security-audits).
