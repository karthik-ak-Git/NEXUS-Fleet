import type { PeerMessage } from "./types";

interface QueuedMessage {
  message: PeerMessage;
  deliverAt: number;
}

export class PeerNetwork {
  private readonly offline = new Set<string>();
  private readonly queue: QueuedMessage[] = [];
  private readonly received = new Map<string, PeerMessage[]>();
  private readonly sequences = new Map<string, number>();
  private messageCount = 0;
  private latencyTotal = 0;
  private deliveredCount = 0;

  setOnline(robotId: string, online: boolean) {
    if (!this.received.has(robotId)) this.received.set(robotId, []);
    if (online) this.offline.delete(robotId);
    else this.offline.add(robotId);
  }

  isOnline(robotId: string) {
    return !this.offline.has(robotId);
  }

  send(
    sender: string,
    target: string | "*",
    type: string,
    payload: Record<string, unknown>,
    now: number,
    ttl = 4,
  ) {
    if (!this.isOnline(sender)) return false;
    const sequence = (this.sequences.get(sender) ?? 0) + 1;
    this.sequences.set(sender, sequence);
    const latency = 0.035 + ((sequence * 17 + sender.length * 11) % 65) / 1000;
    const message: PeerMessage = {
      sender,
      target,
      timestamp: now,
      type,
      payload,
      ttl,
      sequence,
    };
    this.queue.push({ message, deliverAt: now + latency });
    this.messageCount += 1;
    this.latencyTotal += latency;
    return true;
  }

  deliver(now: number) {
    const pending: QueuedMessage[] = [];
    for (const queued of this.queue) {
      const { message, deliverAt } = queued;
      if (message.timestamp + message.ttl < now) continue;
      if (deliverAt > now) {
        pending.push(queued);
        continue;
      }
      const targets =
        message.target === "*"
          ? Array.from(this.received.keys())
          : [message.target];
      for (const target of targets) {
        if (
          target === message.sender ||
          this.offline.has(target) ||
          (message.target !== "*" && target !== message.target)
        ) {
          continue;
        }
        const inbox = this.received.get(target) ?? [];
        inbox.push(message);
        this.received.set(target, inbox.slice(-80));
        this.deliveredCount += 1;
      }
    }
    this.queue.length = 0;
    this.queue.push(...pending);
  }

  drain(robotId: string) {
    const messages = this.received.get(robotId) ?? [];
    this.received.set(robotId, []);
    return messages;
  }

  get totalMessages() {
    return this.messageCount;
  }

  get averageLatency() {
    return this.messageCount === 0 ? 0 : this.latencyTotal / this.messageCount;
  }

  get deliveredMessages() {
    return this.deliveredCount;
  }
}