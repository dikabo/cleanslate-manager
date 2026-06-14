import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
    Users,
    Search,
    Shield,
    Mail,
    Phone,
    Calendar,
    Loader2,
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { CreateUserDialog } from "./CreateUserDialog";
import { EditUserRoleDialog } from "./EditUserRoleDialog";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

const ROLE_LABELS: Record<AppRole, string> = {
    super_admin: "Super Admin",
    manager: "Manager",
    receptionist: "Réceptionniste",
    artisan: "Artisan",
    delivery: "Livreur",
    partner: "Partenaire",
};

const ROLE_COLORS: Record<AppRole, string> = {
    super_admin: "bg-red-100 text-red-800 border-red-200",
    manager: "bg-blue-100 text-blue-800 border-blue-200",
    receptionist: "bg-green-100 text-green-800 border-green-200",
    artisan: "bg-amber-100 text-amber-800 border-amber-200",
    delivery: "bg-purple-100 text-purple-800 border-purple-200",
    partner: "bg-teal-100 text-teal-800 border-teal-200",
};

interface UserProfile {
    id: string;
    user_id: string;
    full_name: string;
    email: string | null;
    phone: string | null;
    created_at: string;
    roles: AppRole[];
}

export function UserManagement() {
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
    const [isRoleDialogOpen, setIsRoleDialogOpen] = useState(false);

    const {
        data: users = [],
        isLoading,
        error,
    } = useQuery({
        queryKey: ["users"],
        queryFn: async () => {
            // Fetch profiles
            const { data: profiles, error: profilesError } = await supabase
                .from("profiles")
                .select("*")
                .order("full_name");

            if (profilesError) throw profilesError;

            // Fetch all roles
            const { data: roles, error: rolesError } = await supabase
                .from("user_roles")
                .select("*");

            if (rolesError) throw rolesError;

            // Merge profiles with their roles
            const userProfiles: UserProfile[] = (profiles || []).map((profile) => ({
                id: profile.id,
                user_id: profile.user_id,
                full_name: profile.full_name,
                email: profile.email,
                phone: profile.phone,
                created_at: profile.created_at,
                roles: (roles || [])
                    .filter((r) => r.user_id === profile.user_id)
                    .map((r) => r.role as AppRole),
            }));

            return userProfiles;
        },
    });

    const filteredUsers = users.filter(
        (user) =>
            user.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            user.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            user.phone?.includes(searchQuery)
    );

    const handleEditRoles = (user: UserProfile) => {
        setSelectedUser(user);
        setIsRoleDialogOpen(true);
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-xl font-semibold flex items-center gap-2">
                        <Users className="h-5 w-5" />
                        Gestion des Utilisateurs
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1">
                        {users.length} utilisateur{users.length > 1 ? "s" : ""} enregistré
                        {users.length > 1 ? "s" : ""}
                    </p>
                </div>
                <CreateUserDialog />
            </div>

            {/* Search */}
            <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Rechercher par nom, email, téléphone..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                />
            </div>

            {/* Users List */}
            {isLoading ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
                    <span className="text-muted-foreground">
                        Chargement des utilisateurs...
                    </span>
                </div>
            ) : error ? (
                <div className="text-center py-12 text-destructive">
                    Erreur lors du chargement des utilisateurs.
                </div>
            ) : filteredUsers.length === 0 ? (
                <div className="text-center py-12">
                    <Users className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-muted-foreground">Aucun utilisateur trouvé</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {filteredUsers.map((user) => (
                        <Card
                            key={user.id}
                            className="card-hover transition-all duration-200"
                        >
                            <CardContent className="pt-6">
                                <div className="flex items-start gap-4">
                                    <Avatar className="h-12 w-12">
                                        <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                                            {user.full_name
                                                .split(" ")
                                                .map((n) => n[0])
                                                .join("")
                                                .toUpperCase()
                                                .slice(0, 2)}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-semibold text-foreground truncate">
                                            {user.full_name}
                                        </h3>
                                        {user.email && (
                                            <div className="flex items-center gap-1.5 mt-1 text-sm text-muted-foreground">
                                                <Mail className="h-3.5 w-3.5 flex-shrink-0" />
                                                <span className="truncate">{user.email}</span>
                                            </div>
                                        )}
                                        {user.phone && (
                                            <div className="flex items-center gap-1.5 mt-0.5 text-sm text-muted-foreground">
                                                <Phone className="h-3.5 w-3.5 flex-shrink-0" />
                                                <span>{user.phone}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Roles */}
                                <div className="mt-4 pt-3 border-t">
                                    <div className="flex flex-wrap gap-1.5 mb-3">
                                        {user.roles.length === 0 ? (
                                            <span className="text-xs text-muted-foreground italic">
                                                Aucun rôle
                                            </span>
                                        ) : (
                                            user.roles.map((role) => (
                                                <Badge
                                                    key={role}
                                                    variant="outline"
                                                    className={`text-xs ${ROLE_COLORS[role]}`}
                                                >
                                                    {ROLE_LABELS[role]}
                                                </Badge>
                                            ))
                                        )}
                                    </div>

                                    <div className="flex items-center justify-between">
                                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                                            <Calendar className="h-3 w-3" />
                                            {format(new Date(user.created_at), "dd MMM yyyy", {
                                                locale: fr,
                                            })}
                                        </span>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleEditRoles(user)}
                                            className="text-xs"
                                        >
                                            <Shield className="h-3.5 w-3.5 mr-1" />
                                            Rôles
                                        </Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Edit Role Dialog */}
            <EditUserRoleDialog
                user={selectedUser}
                isOpen={isRoleDialogOpen}
                onOpenChange={setIsRoleDialogOpen}
            />
        </div>
    );
}
