import { DurableObject } from "cloudflare:workers";
import type { InboxMessage } from "./inbox.types";

export class UserInbox extends DurableObject {
  addMessage(_message: InboxMessage) {
    // TODO: do some sqlite
  }
}
