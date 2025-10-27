const couponTypeDefs = `
  # Coupon Types
  type CouponDetail {
    id: ID!
    code: String!
    partner: Partner
    discountApplied: Int!
    originalAmount: Float
    discountAmount: Float
    finalAmount: Float
    status: String!
    createdAt: String!
    usedAt: String
    expiresAt: String
    isDigitalCard: Boolean!
    type: String!
  }
  
  type CouponStats {
    totalSavings: Float!
    digitalCardTransactions: Int!
    digitalCardSavings: Float!
    couponTransactions: Int!
    couponSavings: Float!
  }
  
  type CouponPagination {
    current: Int!
    total: Int!
    count: Int!
    totalCoupons: Int!
  }
  
  type CouponHistoryResponse {
    coupons: [CouponDetail!]!
    pagination: CouponPagination!
    stats: CouponStats!
  }
  
  input GenerateCouponInput {
    partnerId: ID!
    originalAmount: Float
  }
  
  type GenerateCouponResponse {
    message: String!
    coupon: CouponDetail!
  }
  
  input UseCouponInput {
    code: String!
    actualAmount: Float!
  }
  
  type UseCouponResponse {
    message: String!
    coupon: CouponDetail!
  }
  
  type CouponVerificationResponse {
    exists: Boolean!
    coupon: CouponDetail
  }

  extend type Query {
    getMyCoupons(status: String, limit: Int, page: Int): CouponHistoryResponse!
    verifyCoupon(code: String!): CouponVerificationResponse!
  }

  extend type Mutation {
    generateCoupon(input: GenerateCouponInput!): GenerateCouponResponse!
    useCoupon(input: UseCouponInput!): UseCouponResponse!
  }
`;

export default couponTypeDefs;
