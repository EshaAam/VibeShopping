/**
 * Makes a race deterministic. While armed, each call waits until `parties`
 * calls have arrived, then all continue together - so two requests are sure
 * to have read the same data before either writes.
 */
export function createBarrier() {
  let parties = 0;
  let rounds = 0;
  let waiting: (() => void)[] = [];

  return {
    /** The next `rounds` groups of `parties` calls each meet before going on. */
    arm(nextParties: number, nextRounds = 1) {
      parties = nextParties;
      rounds = nextRounds;
      waiting = [];
    },
    disarm() {
      rounds = 0;
      waiting.forEach((release) => release());
      waiting = [];
    },
    async wait() {
      if (rounds === 0) return;
      await new Promise<void>((resolve) => {
        waiting.push(resolve);
        if (waiting.length === parties) {
          const group = waiting;
          waiting = [];
          rounds -= 1;
          group.forEach((release) => release());
        }
      });
    },
  };
}
