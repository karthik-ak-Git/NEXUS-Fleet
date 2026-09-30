from typing import Dict, List, Set, Optional, Any
from dataclasses import dataclass, field
from ..schemas.negotiation import PeerMessageSchema

@dataclass
class QueuedMessage:
    message: PeerMessageSchema
    deliver_at: float

class PeerNetwork:
    def __init__(self):
        self.queue: List[QueuedMessage] = []
        self.offline: Set[str] = set()
        self.received: Dict[str, List[PeerMessageSchema]] = {}
        self.sequences: Dict[str, int] = {}

    def send(
        self,
        sender: str,
        target: str,
        type_: str,
        payload: Dict[str, Any],
        now: float,
        ttl: float = 4.0
    ) -> bool:
        if sender in self.offline:
            return False

        seq = self.sequences.get(sender, 0) + 1
        self.sequences[sender] = seq

        # Latency simulation
        latency = 0.035 + ((seq * 17 + len(sender) * 11) % 65) / 1000.0
        msg = PeerMessageSchema(
            sender=sender,
            target=target,
            timestamp=now,
            type=type_,
            payload=payload,
            ttl=ttl,
            sequence=seq
        )
        self.queue.append(QueuedMessage(message=msg, deliver_at=now + latency))
        return True

    def set_offline(self, robot_id: str, is_offline: bool):
        if is_offline:
            self.offline.add(robot_id)
        else:
            self.offline.discard(robot_id)

    def deliver(self, now: float) -> int:
        delivered_count = 0
        remaining = []

        for q in self.queue:
            msg = q.message
            if msg.timestamp + msg.ttl < now:
                continue

            if q.deliver_at <= now:
                if msg.target == "*":
                    for rec_id in list(self.received.keys()):
                        if rec_id not in self.offline and rec_id != msg.sender:
                            inbox = self.received.setdefault(rec_id, [])
                            inbox.append(msg)
                            if len(inbox) > 80:
                                self.received[rec_id] = inbox[-80:]
                            delivered_count += 1
                else:
                    if msg.target not in self.offline:
                        inbox = self.received.setdefault(msg.target, [])
                        inbox.append(msg)
                        if len(inbox) > 80:
                            self.received[msg.target] = inbox[-80:]
                        delivered_count += 1
            else:
                remaining.append(q)

        self.queue = remaining
        return delivered_count

    def drain(self, robot_id: str) -> List[PeerMessageSchema]:
        inbox = self.received.get(robot_id, [])
        self.received[robot_id] = []
        return inbox
