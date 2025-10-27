const digitalCardTypeDefs = `
  # Digital Card Types
  type DigitalCard {
    cardNumber: String!
    qrCode: String!
    qrCodeData: String!
    isActive: Boolean!
    validUntil: String!
    timeUntilRotation: Int!
    userPlan: String!
    userInfo: UserInfo!
  }
  
  type UserInfo {
    name: String!
    email: String!
  }
  
  type DigitalCardResponse {
    card: DigitalCard!
    instructions: String!
    security: SecurityInfo!
  }
  
  type SecurityInfo {
    tokenRotates: String!
    currentlyValid: String!
  }
  
  type CardUsage {
    totalScans: Int!
    recentUsage: [RecentUsage!]!
  }
  
  type RecentUsage {
    usedAt: String!
    token: String!
  }
  
  type CardUsageResponse {
    card: BasicCardInfo!
    usage: CardUsage!
    security: SecurityInfo!
  }
  
  type BasicCardInfo {
    cardNumber: String!
    createdAt: String!
    isActive: Boolean!
  }
  
  type ToggleCardResponse {
    message: String!
    card: BasicCardInfo!
  }

  input ValidateCardInput {
    scannedToken: String!
    amount: Float!
    partnerId: ID
  }
  
  type ClientInfo {
    name: String!
    email: String!
    cardNumber: String!
    plan: String!
  }
  
  type DiscountInfo {
    offered: Int!
    applied: Int!
    reason: String!
  }
  
  type AmountInfo {
    original: Float!
    discount: Float!
    final: Float!
    savings: Float!
  }
  
  type ValidationInfo {
    timestamp: String!
    tokenWindow: Int!
    validatedBy: ID!
  }
  
  type CardValidationResponse {
    valid: Boolean!
    client: ClientInfo!
    partner: Partner
    discount: DiscountInfo!
    amounts: AmountInfo!
    validation: ValidationInfo!
  }

  extend type Query {
    getMyDigitalCard: DigitalCardResponse!
    getCardUsageHistory: CardUsageResponse!
  }

  extend type Mutation {
    toggleDigitalCard: ToggleCardResponse!
    resetDigitalCard: MessageResponse!
    validateDigitalCard(input: ValidateCardInput!): CardValidationResponse!
  }
`;

export default digitalCardTypeDefs;
