/**
 * Side-effect imports. Each module registers its commands on load, so
 * `src/cli/index.ts` needs no knowledge of what exists.
 */
import './decay.ts';
import './doctor.ts';
import './edit.ts';
import './ingest.ts';
import './lesson.ts';
import './query.ts';
import './refresh.ts';
import './repair.ts';
import './review.ts';
import './status.ts';
import './supersede.ts';
