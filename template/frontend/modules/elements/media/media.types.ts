export type MediaConfig = {
  readonly desktop: string;
  readonly mobile: string;
  /// True when the block configures mobile media separately. Without it an
  /// empty mobile source is indistinguishable from "inherit the desktop one".
  readonly useMobile: boolean;
};
