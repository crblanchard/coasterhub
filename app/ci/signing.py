#!/usr/bin/env python3
"""App Store signing for the iPhone build, with no Mac and no registered iPhone.

Xcode's automatic signing archives with a DEVELOPMENT profile, which Apple
will only make for a team with a registered device, and Carter's has none
(first TestFlight runs, 2026-10-30). So this asks the App Store Connect API
directly, with the same Team key the upload uses:

  1. revokes the team's Distribution certificates (this script never keeps
     the private key, so last run's is useless; App Store and TestFlight
     builds already signed are not affected by a revoke),
  2. makes a fresh key + CSR, and a Distribution certificate from it,
  3. makes sure the app ID has Push Notifications and Associated Domains,
  4. makes an App Store provisioning profile named PROFILE_NAME,
  5. puts the certificate in a throwaway keychain and the profile where Xcode
     looks.

The app target's Release config signs manually with that profile name
(app/ios/App/App.xcodeproj). Needs: ASC_KEY_ID, ASC_ISSUER_ID, the key at
ASC_KEY_PATH, RUNNER_TEMP. pip: pyjwt cryptography.
"""
import base64, json, os, subprocess, sys, time, urllib.request, urllib.error
import jwt
from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.x509.oid import NameOID

BUNDLE = "org.coasterhub.app"
PROFILE_NAME = "Coaster Hub App Store CI"
CSR_CN = "Coaster Hub CI"
API = "https://api.appstoreconnect.apple.com/v1"
TMP = os.environ["RUNNER_TEMP"]

def token():
    key = open(os.environ["ASC_KEY_PATH"]).read()
    now = int(time.time())
    return jwt.encode({"iss": os.environ["ASC_ISSUER_ID"], "iat": now, "exp": now + 1000, "aud": "appstoreconnect-v1"},
                      key, algorithm="ES256", headers={"kid": os.environ["ASC_KEY_ID"], "typ": "JWT"})

def call(method, path, body=None, ok_conflict=False):
    req = urllib.request.Request(API + path, method=method,
        data=json.dumps(body).encode() if body is not None else None,
        headers={"Authorization": "Bearer " + token(), "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req) as r:
            raw = r.read()
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        text = e.read().decode(errors="replace")
        if ok_conflict and e.code == 409:
            return None
        sys.exit(f"::error::App Store Connect {method} {path} -> {e.code}: {text}")

def run(*cmd):
    subprocess.run(cmd, check=True)

# 1. Old CI certificates and profiles out of the way.
for p in call("GET", "/profiles?limit=200")["data"]:
    if p["attributes"]["name"] == PROFILE_NAME:
        call("DELETE", "/profiles/" + p["id"])
# Apple names a certificate after the team, not the CSR, so the previous run's
# cannot be told apart from any other: every Distribution certificate goes.
# Carter has no Mac, so nothing else signs with them, and a team may hold only
# a few at once.
for c in call("GET", "/certificates?limit=200&filter[certificateType]=DISTRIBUTION")["data"]:
    call("DELETE", "/certificates/" + c["id"])

# 2. Key, CSR, certificate.
key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
csr = x509.CertificateSigningRequestBuilder().subject_name(
    x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, CSR_CN)])).sign(key, hashes.SHA256())
csr_b64 = base64.b64encode(csr.public_bytes(serialization.Encoding.DER)).decode()
cert = call("POST", "/certificates", {"data": {"type": "certificates",
    "attributes": {"certificateType": "DISTRIBUTION", "csrContent": csr_b64}}})["data"]
cert_der = base64.b64decode(cert["attributes"]["certificateContent"])

# 3. The app ID and its capabilities.
ids = call("GET", "/bundleIds?filter[identifier]=" + BUNDLE)["data"]
ids = [b for b in ids if b["attributes"]["identifier"] == BUNDLE]
if not ids:
    sys.exit("::error::No app ID " + BUNDLE + " on developer.apple.com (Identifiers)")
bid = ids[0]["id"]
for cap in ("PUSH_NOTIFICATIONS", "ASSOCIATED_DOMAINS"):
    call("POST", "/bundleIdCapabilities", {"data": {"type": "bundleIdCapabilities",
        "attributes": {"capabilityType": cap},
        "relationships": {"bundleId": {"data": {"type": "bundleIds", "id": bid}}}}}, ok_conflict=True)

# 4. Profile.
prof = call("POST", "/profiles", {"data": {"type": "profiles",
    "attributes": {"name": PROFILE_NAME, "profileType": "IOS_APP_STORE"},
    "relationships": {"bundleId": {"data": {"type": "bundleIds", "id": bid}},
                      "certificates": {"data": [{"type": "certificates", "id": cert["id"]}]}}}})["data"]
prof_bytes = base64.b64decode(prof["attributes"]["profileContent"])
uuid = prof["attributes"]["uuid"]

# 5. Keychain and profile on disk.
kc, pw = os.path.join(TMP, "ci.keychain-db"), "ci"
keyp, certp = os.path.join(TMP, "dist.key"), os.path.join(TMP, "dist.cer")
open(keyp, "wb").write(key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption()))
open(certp, "wb").write(cert_der)
run("security", "create-keychain", "-p", pw, kc)
run("security", "set-keychain-settings", "-lut", "21600", kc)
run("security", "unlock-keychain", "-p", pw, kc)
run("security", "import", keyp, "-k", kc, "-T", "/usr/bin/codesign", "-T", "/usr/bin/security")
run("security", "import", certp, "-k", kc, "-T", "/usr/bin/codesign")
run("security", "set-key-partition-list", "-S", "apple-tool:,apple:,codesign:", "-s", "-k", pw, kc)
listed = subprocess.run(["security", "list-keychains", "-d", "user"], capture_output=True, text=True).stdout
run("security", "list-keychains", "-d", "user", "-s", kc, *[l.strip().strip('"') for l in listed.split("\n") if l.strip()])
os.remove(keyp)
for d in ("~/Library/MobileDevice/Provisioning Profiles", "~/Library/Developer/Xcode/UserData/Provisioning Profiles"):
    d = os.path.expanduser(d); os.makedirs(d, exist_ok=True)
    open(os.path.join(d, uuid + ".mobileprovision"), "wb").write(prof_bytes)
print("Signing ready: certificate", cert["id"], "profile", PROFILE_NAME, uuid)
