import type { SocialSelection } from "@/app/lib/philos/social/socialSelection";
import type { SocialSystemState } from "@/app/lib/philos/social/loadSocialSystem";

export interface ScaleProps {
  social: SocialSystemState;
  selection: SocialSelection;
  params: { [key: string]: string | string[] | undefined };
}
