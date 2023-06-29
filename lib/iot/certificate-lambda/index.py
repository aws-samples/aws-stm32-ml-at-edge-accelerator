import json
import boto3
import datetime
from cryptography import x509
from cryptography.x509.oid import NameOID
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives import hashes

acm_client = boto3.client('acm')


def generate_Keys():
    private_key = ec.generate_private_key(ec.SECP256R1())
    public_key = private_key.public_key()

    subject = issuer = x509.Name([
        x509.NameAttribute(NameOID.COMMON_NAME, u"mysite.com"),
    ])
    csr = x509.CertificateBuilder().subject_name(
        subject
    ).issuer_name(
        issuer
    ).public_key(
        public_key
    ).serial_number(
        x509.random_serial_number()
    ).not_valid_before(
        datetime.datetime.utcnow()
    ).not_valid_after(
        datetime.datetime.utcnow() + datetime.timedelta(days=365)
    ).sign(private_key, hashes.SHA256())

    serialized_private_key = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption()).decode('ascii')

    serialized_public_key = public_key.public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo).decode('ascii')

    serialized_cert = csr.public_bytes(
        serialization.Encoding.PEM).decode('ascii')

    return {
        'private_key': serialized_private_key,
        'public_key': serialized_public_key,
        'certificate': serialized_cert
    }


def on_create(event):
    keys = generate_Keys()
    private_key = keys['private_key']
    public_key = keys['public_key']
    certificate = keys['certificate']

    response = acm_client.import_certificate(
        Certificate=certificate, PrivateKey=private_key)

    certificate_arn = response['CertificateArn']

    return {
        'PhysicalResourceId': certificate_arn,
        'Data': {
            'publicKey': public_key,
            'certificateArn': certificate_arn
        }
    }


def on_delete(event):
    certificate_arn = event['PhysicalResourceId']
    acm_client.delete_certificate(CertificateArn=certificate_arn)
    return {}


def handler(event, context):
    print(event)
    request_type = event['RequestType']
    if request_type == 'Create':
        return on_create(event)
    if request_type == 'Delete':
        return on_delete(event)
