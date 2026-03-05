export default defineEventHandler((event) => {
  const user = event.context.user;
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  throw createError({
    statusCode: 501,
    statusMessage: "Not implemented",
    message: "Not implemented — K8s integration pending",
  });
});
