const baseTypeDefs = `
  # Base Schema
  type Query {
    health: String!
    cacheHealth: CacheHealth!
  }

  type Mutation {
    _empty: String
  }

  type CacheHealth {
    status: String!
    latency: String
    connected: Boolean!
    error: String
  }
`;

export default baseTypeDefs;
