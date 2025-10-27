const authTypeDefs = `
  # Auth Types
  input RegisterInput {
    firstname: String!
    lastname: String!
    email: String!
    password: String!
    confirmPassword: String!
  }

  input VerifyEmailInput {
    email: String!
    code: String!
  }

  input LoginInput {
    email: String!
    password: String!
  }

  type User {
    id: ID!
    firstname: String!
    lastname: String!
    email: String!
    role: String!
    isVerified: Boolean!
    subscription: Subscription
  }

  type MessageResponse {
    message: String!
  }

  type LoginResponse {
    message: String!
    token: String!
    user: User!
    needsSetup: Boolean!
    redirectTo: String!
  }

  extend type Query {
    me: User
  }

  extend type Mutation {
    registerClient(input: RegisterInput!): MessageResponse!
    registerVendor(input: RegisterInput!): MessageResponse!
    verifyEmail(input: VerifyEmailInput!): MessageResponse!
    login(input: LoginInput!): LoginResponse!
  }
`;

export default authTypeDefs;
