import { getShareExtensionKey } from "expo-share-intent";

export function redirectSystemPath({
  path,
  initial,
}: {
  path: string;
  initial: boolean;
}) {
  try {
    if (path.includes(`dataUrl=${getShareExtensionKey()}`)) {
      return initial ? "/" : null;
    }
    return path;
  } catch {
    return initial ? "/" : path;
  }
}
