
module.exports = {
  getPaginationParams: (query) => {
    const page = parseInt(query.page) || 1;
    const limit = parseInt(query.limit) || 20;
    const skip = (page - 1) * limit;
    return { page, limit, skip };
  },
  buildPaginationMeta: (total, page, limit) => ({
    total, page, limit,
    totalPages: Math.ceil(total / limit),
    hasNextPage: page < Math.ceil(total / limit),
    hasPrevPage: page > 1,
  }),
  buildQuery: (query, config) => {
    const andClauses = [];
    const additionalFilters = { ...(config.additionalFilters || {}) };

    if (additionalFilters.$or) {
      andClauses.push({ $or: additionalFilters.$or });
      delete additionalFilters.$or;
    }

    if (query.search && config.searchFields && config.searchFields.length > 0) {
      andClauses.push({
        $or: config.searchFields.map(field => ({ [field]: { $regex: query.search, $options: 'i' } }))
      });
    }

    for (const [key, val] of Object.entries(additionalFilters)) {
      if (val !== undefined && val !== null) {
        andClauses.push({ [key]: val });
      }
    }

    const filters = andClauses.length > 0 ? (andClauses.length === 1 ? andClauses[0] : { $and: andClauses }) : {};
    const sortField = query.sortBy || config.defaultSortField || 'createdAt';
    const sortOrder = query.sortOrder === 'asc' ? 1 : -1;
    const sort = { [sortField]: sortOrder };
    return { filters, sort, page: query.page, limit: query.limit };
  },
  executePaginatedQuery: async (Model, queryOptions, populateOptions = []) => {
    const page = parseInt(queryOptions.page) || 1;
    const limit = parseInt(queryOptions.limit) || 10;
    const skip = (page - 1) * limit;

    let query = Model.find(queryOptions.filters).sort(queryOptions.sort).skip(skip).limit(limit);
    if (populateOptions.length > 0) {
      populateOptions.forEach(pop => {
        query = query.populate(pop);
      });
    }

    const data = await query.exec();
    const total = await Model.countDocuments(queryOptions.filters);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page < Math.ceil(total / limit),
        hasPrevPage: page > 1,
      }
    };
  }
};
