import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Settings as SettingsIcon,
    Building,
    Users,
    Bell,
    Shield,
} from "lucide-react";
import { UserManagement } from "@/components/settings/UserManagement";

export default function Settings() {
    return (
        <AppLayout>
            <div className="space-y-6 animate-fade-in">
                <div>
                    <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">
                        Paramètres
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Configuration de l'application
                    </p>
                </div>

                <Tabs defaultValue="users" className="w-full">
                    <TabsList className="grid w-full grid-cols-4 sm:grid-cols-4">
                        <TabsTrigger value="users" className="gap-1.5">
                            <Users className="h-4 w-4" />
                            <span className="hidden sm:inline">Utilisateurs</span>
                        </TabsTrigger>
                        <TabsTrigger value="workshop" className="gap-1.5">
                            <Building className="h-4 w-4" />
                            <span className="hidden sm:inline">Atelier</span>
                        </TabsTrigger>
                        <TabsTrigger value="notifications" className="gap-1.5">
                            <Bell className="h-4 w-4" />
                            <span className="hidden sm:inline">Notifications</span>
                        </TabsTrigger>
                        <TabsTrigger value="security" className="gap-1.5">
                            <Shield className="h-4 w-4" />
                            <span className="hidden sm:inline">Sécurité</span>
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="users" className="mt-6">
                        <UserManagement />
                    </TabsContent>

                    <TabsContent value="workshop" className="mt-6">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-lg">
                                    <Building className="h-5 w-5" />
                                    Informations Atelier
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="text-sm text-muted-foreground">
                                <p>Nom, adresse et coordonnées de votre atelier.</p>
                                <p className="mt-2 italic">Configuration à venir.</p>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="notifications" className="mt-6">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-lg">
                                    <Bell className="h-5 w-5" />
                                    Notifications
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="text-sm text-muted-foreground">
                                <p>Paramétrer les alertes de stock, rappels clients, etc.</p>
                                <p className="mt-2 italic">Configuration à venir.</p>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="security" className="mt-6">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-lg">
                                    <Shield className="h-5 w-5" />
                                    Sécurité & Rôles
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="text-sm text-muted-foreground">
                                <p>Gestion des rôles et permissions d'accès.</p>
                                <p className="mt-2 italic">Configuration à venir.</p>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </div>
        </AppLayout>
    );
}
