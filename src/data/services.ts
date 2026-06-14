import { Service, ServiceCategory } from "@/types";

// Local service interface for mock data (uses camelCase for local usage)
interface LocalService {
  id: string;
  name: string;
  category: ServiceCategory;
  base_price: number;
  is_custom_price: boolean;
  is_active: boolean;
  created_at: string;
}

export const services: LocalService[] = [
  // Cordonnerie Homme
  { id: "0b4ece09-91a0-4767-8e10-ddcd05f23d11", name: "Patins (semelle, la paire)", category: "cordonnerie_homme", base_price: 10000, is_custom_price: false, is_active: true, created_at: new Date().toISOString() },
  { id: "16874de9-52e8-4b71-bdd3-5ff9f3a61e05", name: "Patins & Fers encastrés", category: "cordonnerie_homme", base_price: 20000, is_custom_price: false, is_active: true, created_at: new Date().toISOString() },
  { id: "70de7d87-be47-49f9-aa16-2fd1b24e6de4", name: "Patins & Entretien", category: "cordonnerie_homme", base_price: 15000, is_custom_price: false, is_active: true, created_at: new Date().toISOString() },
  { id: "b43a9ad3-fa25-4cde-bad9-0e70a4edbf71", name: "Entretien", category: "cordonnerie_homme", base_price: 5000, is_custom_price: false, is_active: true, created_at: new Date().toISOString() },
  { id: "d29792e3-2f95-4aa6-bd69-b5fe1cdff314", name: "Patins & Entretien & Fers encastrés", category: "cordonnerie_homme", base_price: 25000, is_custom_price: false, is_active: true, created_at: new Date().toISOString() },
  { id: "2d08cc4b-3522-4fe7-b765-b3e34b92bde4", name: "Fers encastrés", category: "cordonnerie_homme", base_price: 15000, is_custom_price: false, is_active: true, created_at: new Date().toISOString() },
  { id: "399d8213-aa8d-4cb5-ae00-cfa68df46961", name: "Talons", category: "cordonnerie_homme", base_price: 10000, is_custom_price: false, is_active: true, created_at: new Date().toISOString() },
  { id: "7f339f40-3fb1-43e0-a75d-3d4ff282c0b4", name: "Ressemelage (changement complet de semelle)", category: "cordonnerie_homme", base_price: 20000, is_custom_price: true, is_active: true, created_at: new Date().toISOString() },
  { id: "6ee07cb2-68be-41db-b5c5-e51cdfaeb4ed", name: "Glissoirs", category: "cordonnerie_homme", base_price: 10000, is_custom_price: false, is_active: true, created_at: new Date().toISOString() },
  { id: "da9ec454-e408-410a-86c8-502a5585b7c7", name: "Habillage", category: "cordonnerie_homme", base_price: 10000, is_custom_price: false, is_active: true, created_at: new Date().toISOString() },
  { id: "dd5bbd69-3224-4f0f-af00-5807909dddf3", name: "Première de propreté (coup d'éclat)", category: "cordonnerie_homme", base_price: 3000, is_custom_price: true, is_active: true, created_at: new Date().toISOString() },
  { id: "e9acb64e-be5b-43af-bc32-ea2aa17351c4", name: "Soin - Cirage", category: "cordonnerie_homme", base_price: 3000, is_custom_price: false, is_active: true, created_at: new Date().toISOString() },
  { id: "1d80acb4-d7fa-4279-81bc-ea843194aeb5", name: "Soin - Nettoyage (daim)", category: "cordonnerie_homme", base_price: 7000, is_custom_price: false, is_active: true, created_at: new Date().toISOString() },
  { id: "a482cc24-f77a-4fa4-a472-74d3fe2b8c5a", name: "Soin - Glaçage", category: "cordonnerie_homme", base_price: 15000, is_custom_price: true, is_active: true, created_at: new Date().toISOString() },
  { id: "f1aeb134-8c83-4aae-83de-a8ddbb373ba2", name: "Teinture", category: "cordonnerie_homme", base_price: 10000, is_custom_price: true, is_active: true, created_at: new Date().toISOString() },
  { id: "28ef05b4-d0db-445a-8bc5-fd66e133cde3", name: "Collage (cordonnerie)", category: "cordonnerie_homme", base_price: 5000, is_custom_price: true, is_active: true, created_at: new Date().toISOString() },
  { id: "b46d7907-7359-42b7-bcb9-fb93b749d038", name: "Collage & Couture semelle", category: "cordonnerie_homme", base_price: 7000, is_custom_price: true, is_active: true, created_at: new Date().toISOString() },
  { id: "601201dc-803a-4ef8-a5b8-505bc3585ce0", name: "Agrandissement", category: "cordonnerie_homme", base_price: 10000, is_custom_price: false, is_active: true, created_at: new Date().toISOString() },
  { id: "7a31bfee-5af4-4632-aee7-16d7d5d74261", name: "Lacets", category: "cordonnerie_homme", base_price: 2000, is_custom_price: false, is_active: true, created_at: new Date().toISOString() },
  { id: "95c62eee-ac0f-4e84-a243-2fbc1efe9001", name: "Autres", category: "cordonnerie_homme", base_price: 0, is_custom_price: true, is_active: true, created_at: new Date().toISOString() },

  // Cordonnerie Femme
  { id: "26b48d28-067f-4315-ae7c-502781b0a94d", name: "Patins (semelle, la paire)", category: "cordonnerie_femme", base_price: 10000, is_custom_price: false, is_active: true, created_at: new Date().toISOString() },
  { id: "a249c5e3-6a95-46f9-bf9f-5ee28ffec6a9", name: "Patins & Fers encastrés", category: "cordonnerie_femme", base_price: 20000, is_custom_price: false, is_active: true, created_at: new Date().toISOString() },
  { id: "518fffc2-9a5c-4f7f-8566-aefb19163259", name: "Patins & Entretien", category: "cordonnerie_femme", base_price: 15000, is_custom_price: false, is_active: true, created_at: new Date().toISOString() },
  { id: "ce543a75-1033-4f09-afa3-f11bcad8ed9e", name: "Fers encastrés", category: "cordonnerie_femme", base_price: 15000, is_custom_price: false, is_active: true, created_at: new Date().toISOString() },
  { id: "9d970e53-73ba-47bf-8fdb-bfb022736b47", name: "Entretien", category: "cordonnerie_femme", base_price: 5000, is_custom_price: true, is_active: true, created_at: new Date().toISOString() },
  { id: "d224213d-de34-4b55-a0fa-ae78893d7c38", name: "Talons", category: "cordonnerie_femme", base_price: 10000, is_custom_price: false, is_active: true, created_at: new Date().toISOString() },
  { id: "ecf05244-1144-4861-bfdf-7901b0bce628", name: "Vis", category: "cordonnerie_femme", base_price: 10000, is_custom_price: false, is_active: true, created_at: new Date().toISOString() },
  { id: "d01bc181-42cb-4d56-bde7-39324b17bf4e", name: "Agrandissement / Élargissement", category: "cordonnerie_femme", base_price: 10000, is_custom_price: false, is_active: true, created_at: new Date().toISOString() },
  { id: "63f8260c-2d06-444f-b67c-9b6fd1faabd9", name: "Ressemelage (changement complet de semelle)", category: "cordonnerie_femme", base_price: 20000, is_custom_price: true, is_active: true, created_at: new Date().toISOString() },
  { id: "70eb06b6-aae7-4e00-84c9-b7ee4f15d22b", name: "Glissoirs", category: "cordonnerie_femme", base_price: 10000, is_custom_price: false, is_active: true, created_at: new Date().toISOString() },
  { id: "06bce866-9df9-467f-86f7-cbfd8eefabec", name: "Habillage", category: "cordonnerie_femme", base_price: 10000, is_custom_price: false, is_active: true, created_at: new Date().toISOString() },
  { id: "288591dd-b4fa-4fb5-9051-54ba657a7d41", name: "Première de propreté", category: "cordonnerie_femme", base_price: 3000, is_custom_price: true, is_active: true, created_at: new Date().toISOString() },
  { id: "f6b8ce9f-3d60-4b2a-a957-c337a34cd8be", name: "Soin - Cirage", category: "cordonnerie_femme", base_price: 3000, is_custom_price: false, is_active: true, created_at: new Date().toISOString() },
  { id: "b301297e-128c-4a11-87dc-737cbefd74e1", name: "Soin - Nettoyage (daim)", category: "cordonnerie_femme", base_price: 7000, is_custom_price: false, is_active: true, created_at: new Date().toISOString() },
  { id: "1b7bc88f-a2e6-4251-ba5d-e5746adfed56", name: "Teinture", category: "cordonnerie_femme", base_price: 10000, is_custom_price: true, is_active: true, created_at: new Date().toISOString() },
  { id: "f48b9f1d-7b24-4f40-8dc0-589fdf26bb75", name: "Collage (cordonnerie)", category: "cordonnerie_femme", base_price: 5000, is_custom_price: true, is_active: true, created_at: new Date().toISOString() },
  { id: "b46fa82f-870a-4a25-83e8-5f9030fd5d68", name: "Collage & Couture semelle", category: "cordonnerie_femme", base_price: 7000, is_custom_price: true, is_active: true, created_at: new Date().toISOString() },
  { id: "f58d0dc1-9878-4cd7-9759-dd3ad34be288", name: "Lacets", category: "cordonnerie_femme", base_price: 2000, is_custom_price: false, is_active: true, created_at: new Date().toISOString() },
  { id: "ff7e0308-cb75-43a5-a448-f78ee2d69b87", name: "Autres", category: "cordonnerie_femme", base_price: 0, is_custom_price: true, is_active: true, created_at: new Date().toISOString() },

  // Sneakers
  { id: "26b65349-2e6f-47dc-95ff-0cf83fc046cd", name: "Ressemelage (changement complet de semelle)", category: "sneakers", base_price: 15000, is_custom_price: true, is_active: true, created_at: new Date().toISOString() },
  { id: "a4253372-f67d-45bf-9b9c-d4aeff4d05ed", name: "Changement de bloc semelle", category: "sneakers", base_price: 10000, is_custom_price: true, is_active: true, created_at: new Date().toISOString() },
  { id: "2a5db327-0b1d-4033-b2db-f32a0c242fdb", name: "Glissoirs", category: "sneakers", base_price: 10000, is_custom_price: false, is_active: true, created_at: new Date().toISOString() },
  { id: "8b3fb575-c5ff-4cd0-abea-dcaaf2dbdb80", name: "Reprise couture", category: "sneakers", base_price: 5000, is_custom_price: false, is_active: true, created_at: new Date().toISOString() },
  { id: "d2c49c71-3ebd-4e65-ba81-1250f14d9b73", name: "Collage & Couture semelle", category: "sneakers", base_price: 7000, is_custom_price: true, is_active: true, created_at: new Date().toISOString() },
  { id: "ed2f87ab-284a-4a87-bf6f-cfc27329d6af", name: "Soin / Nettoyage sneakers", category: "sneakers", base_price: 5000, is_custom_price: true, is_active: true, created_at: new Date().toISOString() },
  { id: "bc3032d8-5b4d-4d43-9828-569b922d56a7", name: "Soin / Nettoyage sneakers (complexe)", category: "sneakers", base_price: 10000, is_custom_price: true, is_active: true, created_at: new Date().toISOString() },
  { id: "eb68eb49-5a9e-4aef-ba92-ca7fa7f7ba52", name: "Teinture", category: "sneakers", base_price: 10000, is_custom_price: true, is_active: true, created_at: new Date().toISOString() },
  { id: "6ee560aa-43e5-42be-bc70-4f5dbf1a4e1d", name: "Teinture (Montantes)", category: "sneakers", base_price: 15000, is_custom_price: true, is_active: true, created_at: new Date().toISOString() },
  { id: "70fd2ba4-6a84-4061-8cf0-23a7e008ba9f", name: "Teinture complète (Avec semelle)", category: "sneakers", base_price: 20000, is_custom_price: true, is_active: true, created_at: new Date().toISOString() },
  { id: "67610ef3-585d-4f6c-829d-6490333d87b3", name: "Agrandissement / Élargissement", category: "sneakers", base_price: 10000, is_custom_price: false, is_active: true, created_at: new Date().toISOString() },
  { id: "5a4e526a-9baf-4bd6-be0d-44a6debfcc7c", name: "Lacets", category: "sneakers", base_price: 2000, is_custom_price: false, is_active: true, created_at: new Date().toISOString() },
  { id: "d66f5cbb-f19c-45e2-bd85-4bd40d33ae49", name: "Autres", category: "sneakers", base_price: 0, is_custom_price: true, is_active: true, created_at: new Date().toISOString() },

  // Maroquinerie
  { id: "96c14c50-2bc6-4ffc-bb13-5a02796e95c1", name: "Soin / Nettoyage extérieur et repigmentation Sac à main", category: "maroquinerie", base_price: 15000, is_custom_price: true, is_active: true, created_at: new Date().toISOString() },
  { id: "e9d77f24-ec40-429a-ae19-bf98b1ec31ae", name: "Soin / Nettoyage extérieur et repigmentation Sac a de voyage", category: "maroquinerie", base_price: 20000, is_custom_price: true, is_active: true, created_at: new Date().toISOString() },
  { id: "4eb74bfb-70dc-4277-bf41-e9bbdecddb8e", name: "Soin / Nettoyage veste", category: "maroquinerie", base_price: 0, is_custom_price: true, is_active: true, created_at: new Date().toISOString() },
  { id: "0ebf928a-6617-4560-a249-16b71f280a87", name: "Changement de couleur de teinture (Sac à main)", category: "maroquinerie", base_price: 20000, is_custom_price: true, is_active: true, created_at: new Date().toISOString() },
  { id: "066bf9eb-a886-444f-ac57-a35948332152", name: "Changement de couleur de teinture (Sac de voyage)", category: "maroquinerie", base_price: 0, is_custom_price: true, is_active: true, created_at: new Date().toISOString() },
  { id: "34ea3f82-2a78-43da-8e10-4107ebad241d", name: "Teinture dans la masse ton sur ton", category: "maroquinerie", base_price: 0, is_custom_price: true, is_active: true, created_at: new Date().toISOString() },
  { id: "3999e900-a612-40a8-b615-563b72b83eb0", name: "Restructuration du cuir", category: "maroquinerie", base_price: 0, is_custom_price: true, is_active: true, created_at: new Date().toISOString() },
  { id: "d2cbaa94-aa26-44b2-a401-443b711eaadb", name: "Changement de la bandoulière", category: "maroquinerie", base_price: 0, is_custom_price: true, is_active: true, created_at: new Date().toISOString() },
  { id: "d7211bf0-cc17-48ec-9ff6-3ba1fcff20b5", name: "Changement d'une poignée / anse", category: "maroquinerie", base_price: 0, is_custom_price: true, is_active: true, created_at: new Date().toISOString() },
  { id: "fbe2c0dd-3721-4d9f-a0e2-b06f7b11d9eb", name: "Changement de la doublure du sac", category: "maroquinerie", base_price: 0, is_custom_price: true, is_active: true, created_at: new Date().toISOString() },
  { id: "6483486c-73ca-4a67-b8db-4155fb6dc841", name: "Changement de la bordure à cheval", category: "maroquinerie", base_price: 0, is_custom_price: true, is_active: true, created_at: new Date().toISOString() },
  { id: "8dbba2ef-d7cd-4c91-95c5-ac1f496ee8df", name: "Changement d'un jonc", category: "maroquinerie", base_price: 0, is_custom_price: true, is_active: true, created_at: new Date().toISOString() },
  { id: "0db6ae65-27a9-4de0-84cf-240bc1c79089", name: "Changement de la Fermeture à Glissière", category: "maroquinerie", base_price: 0, is_custom_price: true, is_active: true, created_at: new Date().toISOString() },
  { id: "70c3ba96-7df1-4384-9345-d856bdcd35cb", name: "Teinture de tranche", category: "maroquinerie", base_price: 0, is_custom_price: true, is_active: true, created_at: new Date().toISOString() },
  { id: "cbba108f-28c0-4824-a212-fcb0fd775553", name: "Réparation Ceinture", category: "maroquinerie", base_price: 2000, is_custom_price: false, is_active: true, created_at: new Date().toISOString() },
  { id: "9d0ba7ca-c4eb-48b4-bc2c-de3542ebae27", name: "Extras", category: "maroquinerie", base_price: 1000, is_custom_price: true, is_active: true, created_at: new Date().toISOString() },
  { id: "e918714b-9f1a-4c0a-b632-7615e60a8fa3", name: "Autres", category: "maroquinerie", base_price: 0, is_custom_price: true, is_active: true, created_at: new Date().toISOString() },
];

export const serviceCategories = {
  cordonnerie_homme: "Cordonnerie Homme",
  cordonnerie_femme: "Cordonnerie Femme",
  sneakers: "Sneakers",
  maroquinerie: "Maroquinerie",
};

export function getServicesByCategory(category: string): LocalService[] {
  return services.filter((s) => s.category === category);
}

export function formatPrice(price: number): string {
  return new Intl.NumberFormat('fr-FR').format(price) + ' FCFA';
}
