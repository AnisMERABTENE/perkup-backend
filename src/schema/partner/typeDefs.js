const partnerTypeDefs = `
  # Partner/Store Types
  type Location {
    latitude: Float!
    longitude: Float!
  }
  
  type Partner {
    id: ID!
    name: String!
    category: String!
    address: String!
    city: String!
    zipCode: String!
    phone: String!
    discount: Int!
    description: String
    logo: String
    location: Location
    distance: Float
    offeredDiscount: Int!
    userDiscount: Int!
    isPremiumOnly: Boolean!
    canAccessFullDiscount: Boolean!
    needsSubscription: Boolean!
    website: String
    isActive: Boolean!
    createdAt: String!
  }
  
  type PartnerDetail {
    id: ID!
    name: String!
    category: String!
    address: String!
    city: String!
    zipCode: String!
    phone: String!
    discount: Int!
    description: String
    logo: String
    location: Location
    offeredDiscount: Int!
    userDiscount: Int!
    isPremiumOnly: Boolean!
    userPlan: String!
    canAccessFullDiscount: Boolean!
    needsSubscription: Boolean!
    website: String
    createdAt: String!
    updatedAt: String!
    _cacheInfo: CacheInfo
  }
  
  # 🚀 Type pour les métadonnées de cache
  type CacheInfo {
    generatedAt: String!
    forPlan: String!
    cacheKey: String!
    source: String!
    retrievedAt: String
    searchMethod: String
  }
  
  type PartnerSearchResponse {
    partners: [Partner!]!
    userPlan: String!
    searchParams: SearchParams!
    totalFound: Int!
    isGeoSearch: Boolean!
  }
  
  type PartnerListResponse {
    partners: [Partner!]!
    userPlan: String!
    totalPartners: Int!
    availableCategories: [String!]!
  }
  
  type SearchParams {
    location: SearchLocation
    radius: Float!
    category: String
    city: String
    name: String
  }
  
  type SearchLocation {
    lat: Float!
    lng: Float!
  }
  
  type Category {
    value: String!
    label: String!
  }
  
  type CategoryResponse {
    categories: [Category!]!
    total: Int!
  }
  
  type CitiesResponse {
    cities: [String!]!
    total: Int!
  }
  
  type CityCoordinates {
    latitude: Float!
    longitude: Float!
    partnerCount: Int!
  }
  
  type CityCoordinatesResponse {
    cityCoordinates: String!
    totalCities: Int!
    cities: [String!]!
  }

  # Partner Input Types
  input PartnerInput {
    name: String!
    category: String!
    address: String!
    city: String!
    zipCode: String!
    phone: String!
    discount: Int!
    description: String
    logo: String
    website: String
    latitude: Float
    longitude: Float
  }

  input PartnerUpdateInput {
    name: String
    category: String
    address: String
    city: String
    zipCode: String
    phone: String
    discount: Int
    description: String
    logo: String
    website: String
    latitude: Float
    longitude: Float
    isActive: Boolean
  }

  # Partner Response Types
  type PartnerMutationResponse {
    success: Boolean!
    message: String!
    partner: Partner
  }

  extend type Query {
    searchPartners(lat: Float, lng: Float, radius: Float, category: String, city: String, name: String, limit: Int): PartnerSearchResponse!
    getPartners(category: String): PartnerListResponse!
    getPartner(id: ID!): PartnerDetail!
    getCategories: CategoryResponse!
    getCities: CitiesResponse!
    getCityCoordinates: CityCoordinatesResponse!
  }

  extend type Mutation {
    createPartner(input: PartnerInput!): PartnerMutationResponse!
    updatePartner(id: ID!, input: PartnerUpdateInput!): PartnerMutationResponse!
    deletePartner(id: ID!): PartnerMutationResponse!
  }
`;

export default partnerTypeDefs;
