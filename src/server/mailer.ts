import "server-only";

/**
 * Minimal mail delivery seam. In development (or when no provider is
 * configured) messages are logged to the server console so flows like
 * password reset remain fully testable without SMTP credentials.
 *
 * To wire a real provider, implement this function against your transactional
 * email service and configure its credentials via environment variables.
 */
export interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

export async function sendMail(message: MailMessage): Promise<void> {
  // No external provider configured: log instead of silently dropping.
  console.info(`[mailer] To: ${message.to}\n[mailer] Subject: ${message.subject}\n${message.text}`);
}
