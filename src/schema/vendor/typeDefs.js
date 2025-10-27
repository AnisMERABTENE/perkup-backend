const vendorTypeDefs = `
  input CreateStoreInput {
    name: String!
    category: String!
    address: String!
    phone: String!
    discount: Int!
    description: String
    logo: String
    location: LocationInput
  }
  
  input UpdateStoreInput {
    name: String!
    category: String!
    address: String!
    phone: String!
    discount: Int!
    description: String
    logo: String
    location: LocationInput
  }
  
  input LocationInput {
    coordinates: [Float!]!
  }

  input GenerateUploadSignatureInput {
    folder: String
  }

  type UploadSignature {
    signature: String!
    timestamp: Int!
    cloudName: String!
    apiKey: String!
    uploadParams: UploadParams!
  }

  type UploadParams {
    folder: String!
    resource_type: String!
    allowed_formats: String!
    transformation: String!
    overwrite: Boolean!
    invalidate: Boolean!
  }

  type GenerateUploadSignatureResponse {
    success: Boolean!
    data: UploadSignature
    error: String
  }
  
  type Store {
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
    isActive: Boolean!
    createdAt: String!
    updatedAt: String
  }
  
  type VendorProfile {
    user: VendorUser!
    stores: [Store!]!
    hasStores: Boolean!
    totalStores: Int!
    isSetupComplete: Boolean!
  }
  
  type VendorUser {
    id: ID!
    firstname: String!
    lastname: String!
    email: String!
    role: String!
    isVerified: Boolean!
    createdAt: String!
  }
  
  type VendorStoresResponse {
    stores: [Store!]!
    total: Int!
    vendor: VendorInfo!
  }
  
  type VendorInfo {
    id: ID!
    name: String!
    email: String!
  }
  
  type CreateStoreResponse {
    message: String!
    store: Store!
  }
  
  type UpdateStoreResponse {
    message: String!
    store: Store!
  }

  extend type Query {
    getVendorProfile: VendorProfile!
    getVendorStores: VendorStoresResponse!
    generateUploadSignature(input: GenerateUploadSignatureInput): GenerateUploadSignatureResponse!
  }

  extend type Mutation {
    createStore(input: CreateStoreInput!): CreateStoreResponse!
    updateStore(input: UpdateStoreInput!): UpdateStoreResponse!
  }
`;

export default vendorTypeDefs;
