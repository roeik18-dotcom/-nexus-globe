/** The spine's link keys, as their own type so `spineTouch` cannot name a
 *  link that does not exist. Kept separate to avoid a cycle with the value
 *  system, which imports nothing from `social/`. */
export type SpineLinkKey =
  | "contradiction" | "emergent_value" | "personal_value"
  | "group_value" | "value_group" | "membership";
