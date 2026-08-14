/**
 * Side-effect imports. Each module registers its commands on load, so
 * `src/cli/index.ts` needs no knowledge of what exists.
 */
import './doctor.ts';
import './ingest.ts';
import './lesson.ts';
import './review.ts';
