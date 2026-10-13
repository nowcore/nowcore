import { Logger } from '@nestjs/common';

export interface Email {
  to: string;
  subject: string;
  text: string;
}

/** Where buyer emails go. A port, so a provider change never touches the jobs. */
export interface Mailer {
  send(email: Email): Promise<void>;
}

/** Local development: prints the email instead of sending it. */
export class ConsoleMailer implements Mailer {
  private readonly log = new Logger('mail');
  readonly sent: Email[] = [];
  async send(email: Email): Promise<void> {
    this.sent.push(email);
    this.log.log(`to ${email.to} — ${email.subject}`);
  }
}

/**
 * Resend's HTTP API (POST /emails, bearer key). Written to their documented
 * shape; not yet run against Resend — there is no key (docs/08).
 */
export class ResendMailer implements Mailer {
  constructor(
    private readonly key: string,
    private readonly from: string,
  ) {}
  async send(email: Email): Promise<void> {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.key}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        from: this.from,
        to: email.to,
        subject: email.subject,
        text: email.text,
      }),
    });
    if (!res.ok) throw new Error(`resend: ${res.status} ${await res.text()}`);
  }
}
