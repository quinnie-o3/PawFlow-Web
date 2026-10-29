import type { PetState } from "../types";

export function createCustomerPetsMock(): PetState {
  return {
    // Demo IDs/names, not a live backend taxonomy.
    petTypes: [{ id: "1", name: "Chó", status: "ACTIVE" }, { id: "2", name: "Mèo", status: "ACTIVE" }],
    pets: [{
      id: "pet-milo", ownerId: "customer-demo", status: "ACTIVE", version: 1,
      name: "Milo", petTypeId: "1", breed: "Poodle",
      // Explicit fictional date (also the DTO example), never inferred from an age.
      birthDate: "2023-05-20", weight: 5.5, healthNote: "Dễ căng thẳng khi sấy",
      image: { url: "/customer-pets/milo.png", fileName: "milo.png", mimeType: "image/png", size: 27658, width: 120, height: 120 },
    }],
  };
}
