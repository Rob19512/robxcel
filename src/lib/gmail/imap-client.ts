import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { convert } from "html-to-text";

export type FetchedEmail = {
  gmailMessageId: string;
  subject: string;
  text: string;
};

const DEFAULT_TICKETMASTER_QUERY =
  'from:emailservices@ticketmaster.fr subject:"Confirmation de votre commande" is:unread';

export async function fetchUnreadTicketmasterEmails(): Promise<FetchedEmail[]> {
  const user = process.env.GMAIL_IMAP_USER;
  const pass = process.env.GMAIL_IMAP_APP_PASSWORD;
  if (!user || !pass) {
    throw new Error("GMAIL_IMAP_USER / GMAIL_IMAP_APP_PASSWORD ne sont pas configurés");
  }

  const query = process.env.TICKETMASTER_GMAIL_QUERY?.trim() || DEFAULT_TICKETMASTER_QUERY;

  const client = new ImapFlow({
    host: "imap.gmail.com",
    port: 993,
    secure: true,
    auth: { user, pass },
    logger: false,
  });

  const results: FetchedEmail[] = [];

  await client.connect();
  try {
    const lock = await client.getMailboxLock("INBOX");
    try {
      const uids = await client.search({ gmailRaw: query } as never, { uid: true });
      if (!uids || uids.length === 0) return results;

      for await (const message of client.fetch(uids, { source: true, uid: true }, { uid: true })) {
        if (!message.source) continue;
        const parsed = await simpleParser(message.source);
        // Les emails Ticketmaster sont HTML-only (pas de partie text/plain) : on convertit
        // nous-mêmes, en ignorant les href pour ne pas polluer les lignes avec des URLs.
        const text =
          parsed.text ||
          convert(parsed.html || "", {
            wordwrap: false,
            selectors: [{ selector: "a", options: { ignoreHref: true } }],
          });
        results.push({
          gmailMessageId: parsed.messageId ?? `ticketmaster-uid-${message.uid}`,
          subject: parsed.subject ?? "",
          text,
        });
      }

      // Marque les mails comme lus une fois récupérés : purement indicatif côté Gmail,
      // le dédoublonnage réel se fait en base sur gmailMessageId.
      await client.messageFlagsAdd(uids, ["\\Seen"], { uid: true });
    } finally {
      lock.release();
    }
  } finally {
    await client.logout();
  }

  return results;
}
