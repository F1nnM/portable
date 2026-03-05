import { listScaffolds } from "../../utils/github";

export default defineEventHandler(() => {
  const scaffolds = listScaffolds();
  return { scaffolds };
});
