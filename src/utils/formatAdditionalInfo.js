/**
 * Formats a product's additional info (Map or object) into an array of { key, value }.
 */
module.exports = function formatAdditionalInfo(product) {
  if (!product) return [];

  // Access both camelCase and snake_case
  const info = product.additional_info || product.additionalInfo;

  if (!info) return [];

  // If it is a Map (Mongoose Map), convert to plain object first
  const obj =
    info instanceof Map
      ? Object.fromEntries(info)
      : typeof info === "object"
      ? info
      : {};

  return Object.entries(obj).map(([key, value]) => ({ key, value }));
};
