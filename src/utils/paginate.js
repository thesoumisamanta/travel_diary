/**
 * Paginate mongoose queries easily
 * @param {Model} model - Mongoose model
 * @param {Object} filter - MongoDB filter
 * @param {Object} options - { page, limit, sort, populate }
 */
export const paginate = async (model, filter = {}, options = {}) => {
  const page = parseInt(options.page, 10) || 1;
  const limit = parseInt(options.limit, 10) || 20;
  const skip = (page - 1) * limit;

  const [data, total] = await Promise.all([
    model.find(filter)
      .sort(options.sort || { createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate(options.populate || ''),
    model.countDocuments(filter)
  ]);

  return {
    data,
    pagination: {
      total,
      page,
      pages: Math.ceil(total / limit),
      limit
    }
  };
};
