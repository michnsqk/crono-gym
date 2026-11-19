/**
 * AnatomicalRanksPage.tsx — route wrapper for `/rangos`.
 *
 * Delegates directly to `AnatomicalRanksView` so `/rangos` and Coach Portal
 * (`AthleteCRM`) share the exact same Apple Fitness+ / Apple Health OLED
 * instrument without duplicate UI trees.
 */

import type { Slug } from "react-muscle-highlighter";
import { AnatomicalRanksView } from "../AnatomicalRanksView";

interface AnatomicalRanksPageProps {
  userId: string | null;
  onBrowseMuscle?: (slug: Slug) => void;
  initialDetail?: string | null;
  readOnly?: boolean;
}

export function AnatomicalRanksPage(props: AnatomicalRanksPageProps) {
  return <AnatomicalRanksView {...props} embedded />;
}
