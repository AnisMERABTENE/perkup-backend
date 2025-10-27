const { gql } = require('apollo-server-lambda');

// Import des sous-schémas
const authTypeDefs = require('./auth/typeDefs');
const partnerTypeDefs = require('./partner/typeDefs');
const couponTypeDefs = require('./coupon/typeDefs');
const digitalCardTypeDefs = require('./digitalCard/typeDefs');
const vendorTypeDefs = require('./vendor/typeDefs');
const subscriptionTypeDefs = require('./subscription/typeDefs');

// 📐 Schéma principal
const rootTypeDefs = gql`
  # 📅 Types de base
  scalar Date
  scalar JSON

  # 🌍 Types géographiques
  type Location {
    type: String!
    coordinates: [Float!]!
  }

  type Address {
    street: String
    city: String!
    zipCode: String!
    country: String!
    location: Location
  }

  # 📊 Types de pagination
  type PageInfo {
    hasNextPage: Boolean!
    hasPreviousPage: Boolean!
    startCursor: String
    endCursor: String
  }

  # 🔄 Types de statut pour jobs asynchrones
  type Job {
    jobId: ID!
    status: JobStatus!
    result: JSON
    error: String
    progress: Int
    createdAt: Date!
    updatedAt: Date!
  }

  enum JobStatus {
    PENDING
    IN_PROGRESS
    COMPLETED
    FAILED
  }

  # 📝 Types de réponse générique
  type SuccessResponse {
    success: Boolean!
    message: String!
    data: JSON
  }

  type ErrorResponse {
    success: Boolean!
    message: String!
    errors: [String!]
  }

  # 🎯 Root Query
  type Query {
    # Health check
    health: String!
    
    # Job monitoring
    getJob(jobId: ID!): Job
  }

  # 🚀 Root Mutation
  type Mutation {
    # Test mutation
    ping: String!
  }

  # 🔔 Root Subscription
  type Subscription {
    # Job status updates
    jobStatusChanged(jobId: ID!): Job!
  }
`;

// 🎭 Assemblage de tous les types
module.exports = [
  rootTypeDefs,
  authTypeDefs,
  partnerTypeDefs,
  couponTypeDefs,
  digitalCardTypeDefs,
  vendorTypeDefs,
  subscriptionTypeDefs,
];
