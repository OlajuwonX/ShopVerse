type AnnouncementListener = (message: string) => void;

const listeners = new Set<AnnouncementListener>();

let latest = "";

export function subscribeToAnnouncements(listener: AnnouncementListener) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

export function getLatestAnnouncement() {
  return latest;
}

export function announce(message: string) {
  latest = message;

  for (const listener of listeners) {
    listener(message);
  }
}
