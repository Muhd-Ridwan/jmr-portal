import resend
from app.config import RESEND_API_KEY, EMAIL_FROM, FRONTEND_URL

resend.api_key = RESEND_API_KEY

def send_onboarding_email(to_email: str, parent_name: str, token: str):
    link = f"{FRONTEND_URL}/onboarding?token={token}"
    resend.Emails.send({
        "from": EMAIL_FROM,
        "to": to_email,
        "subject": "Welcome to JMR Portal - Set Up Your Account",
        "html": f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Welcome, {parent_name}!</h2>
            <p>Your account has been created on JMR Portal.</p>
            <p>Click the button below to set up your password and complete your registration. This link expires in <strong>30 minutes</strong>.</p>
            <a href="{link}" style="
                display: inline-block;
                padding: 12px 24px;
                background-color: #2563eb;
                color: white;
                text-decoration: none;
                border-radius: 6px;
                margin: 16px 0;
                ">Set Up My Account</a>
                <p>If you did not expect this email, please ignore it.</p>
                <p>Best Regards,</p>
                <p>Umi Apak</p>
                <p>01111797324</p>
        </div>
        """
    })

def send_password_reset_email(to_email: str, name: str, token: str):
    link = f"{FRONTEND_URL}/reset-password?token={token}"
    resend.Emails.send({
        "from": EMAIL_FROM,
        "to": to_email,
        "subject": "JMR Portal - Password Reset Request",
        "html": f"""
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2>Password Reset</h2>
                <p>Hi {name},</p>
                <p>We received a request to reset your password. Click the button below to proceed. This link expires in <strong>15 minutes</strong>.</p>
                <a href="{link}" style="
                    display: inline-block;
                    padding: 12px 24px;
                    background-color: #2563eb;
                    color: white;
                    text-decoration: none;
                    border-radius: 6px;
                    margin: 16px 0;
                    ">Reset My Password</a>
                    <p>If you did not request a password reset, please ignore this email.</p>
                    <p>Best Regards,</p>
                    <p>Umi Apak</p>
                    <p>01111797324</p>
            </div>
        """
    })