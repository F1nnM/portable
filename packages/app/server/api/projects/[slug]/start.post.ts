export default defineEventHandler((_event) => {
  throw createError({
    statusCode: 501,
    statusMessage: "Not implemented",
    message: "Not implemented — K8s integration pending",
  });
});
