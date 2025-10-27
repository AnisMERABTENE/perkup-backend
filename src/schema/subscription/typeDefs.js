const subscriptionTypeDefs = `
  # Subscription Types
  input CreateSubscriptionInput {
    plan: PlanType!
  }
  
  enum PlanType {
    basic
    super
    premium
  }
  
  type Subscription {
    plan: String
    status: String!
    stripeSubscriptionId: String
    stripeCustomerId: String
    currentPeriodStart: String
    currentPeriodEnd: String
    endDate: String
  }
  
  type SubscriptionStatus {
    subscription: Subscription!
    isActive: Boolean!
    subscriptionType: String!
  }
  
  type CreateSubscriptionResponse {
    subscriptionId: String!
    clientSecret: String
    status: String!
    isUpgrade: Boolean!
    requiresPayment: Boolean!
  }
  
  type DiscountResponse {
    originalDiscount: Int!
    cappedDiscount: Int!
    userPlan: String!
    maxDiscount: Int!
    message: String!
  }

  extend type Query {
    getSubscriptionStatus: SubscriptionStatus!
    getPartnerDiscount(partnerDiscount: Int!): DiscountResponse!
  }

  extend type Mutation {
    createSubscription(input: CreateSubscriptionInput!): CreateSubscriptionResponse!
    cancelSubscription: MessageResponse!
    reactivateSubscription: MessageResponse!
  }
`;

export default subscriptionTypeDefs;
