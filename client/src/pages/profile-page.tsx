import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "@/hooks/use-language";
import { useIsMobile } from "@/hooks/use-mobile";
import { useQuery } from "@tanstack/react-query";
import { DocumentUpload } from "@/components/profile/document-upload";
import { Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const ProfilePage = () => {
  const { user } = useAuth();
  const { language, t } = useLanguage();
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState("info");

  // Fetch user profile data
  const { data: profile, isLoading: isProfileLoading } = useQuery({
    queryKey: ["/api/user-profile"],
    enabled: !!user,
  });

  // Fetch user's company documents
  const { data: documents, isLoading: isDocumentsLoading } = useQuery({
    queryKey: ["/api/company-documents"],
    enabled: !!user,
  });

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-6">
        {language === "ar" ? "الملف الشخصي" : "Profile"}
      </h1>

      <Tabs
        defaultValue="info"
        value={activeTab}
        onValueChange={setActiveTab}
        className="w-full"
      >
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="info">
            {language === "ar" ? "معلومات الشركة" : "Company Info"}
          </TabsTrigger>
          <TabsTrigger value="documents">
            {language === "ar" ? "المستندات" : "Documents"}
          </TabsTrigger>
          <TabsTrigger value="preferences">
            {language === "ar" ? "التفضيلات" : "Preferences"}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="info" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>
                {language === "ar" ? "معلومات الشركة" : "Company Information"}
              </CardTitle>
              <CardDescription>
                {language === "ar"
                  ? "المعلومات الأساسية عن شركتك"
                  : "Basic information about your company"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isProfileLoading ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <h3 className="font-medium text-sm text-muted-foreground mb-1">
                      {language === "ar" ? "اسم الشركة" : "Company Name"}
                    </h3>
                    <p className="text-base">{user.companyName}</p>
                  </div>

                  <div>
                    <h3 className="font-medium text-sm text-muted-foreground mb-1">
                      {language === "ar" ? "وصف الشركة" : "Company Description"}
                    </h3>
                    <p className="text-base">
                      {profile?.companyDescription || 
                        (language === "ar" 
                          ? "لم يتم إضافة وصف بعد. قم بتحميل مستندات الشركة للحصول على وصف تلقائي."
                          : "No description added yet. Upload company documents to get an automatic description.")
                      }
                    </p>
                  </div>

                  {profile?.businessType && (
                    <div>
                      <h3 className="font-medium text-sm text-muted-foreground mb-1">
                        {language === "ar" ? "نوع العمل" : "Business Type"}
                      </h3>
                      <p className="text-base">{profile.businessType}</p>
                    </div>
                  )}

                  {profile?.companyActivities && profile.companyActivities.length > 0 && (
                    <div>
                      <h3 className="font-medium text-sm text-muted-foreground mb-1">
                        {language === "ar" ? "أنشطة الشركة" : "Company Activities"}
                      </h3>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {Array.isArray(profile.companyActivities) && profile.companyActivities.map((activity, index) => (
                          <Badge key={index} variant="secondary">
                            {activity}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {profile?.mainIndustries && profile.mainIndustries.length > 0 && (
                    <div>
                      <h3 className="font-medium text-sm text-muted-foreground mb-1">
                        {language === "ar" ? "القطاعات الرئيسية" : "Main Industries"}
                      </h3>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {Array.isArray(profile.mainIndustries) && profile.mainIndustries.map((industry, index) => (
                          <Badge key={index} variant="secondary">
                            {industry}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {profile?.specializations && profile.specializations.length > 0 && (
                    <div>
                      <h3 className="font-medium text-sm text-muted-foreground mb-1">
                        {language === "ar" ? "التخصصات" : "Specializations"}
                      </h3>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {Array.isArray(profile.specializations) && profile.specializations.map((specialization, index) => (
                          <Badge key={index} variant="secondary">
                            {specialization}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <h3 className="font-medium text-sm text-muted-foreground mb-1">
                      {language === "ar" ? "إنشاء المستخدم" : "Username"}
                    </h3>
                    <p className="text-base">{user.username}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents" className="mt-4">
          <div className="grid gap-6">
            <DocumentUpload />

            <Card>
              <CardHeader>
                <CardTitle>
                  {language === "ar" ? "المستندات المُحملة" : "Uploaded Documents"}
                </CardTitle>
                <CardDescription>
                  {language === "ar"
                    ? "مستندات الشركة التي تم تحميلها إلى النظام"
                    : "Company documents that have been uploaded to the system"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isDocumentsLoading ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : documents && documents.length > 0 ? (
                  <div className="space-y-4">
                    {documents.map((doc: any) => (
                      <div key={doc.id} className="border rounded-lg p-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="font-medium">{doc.fileName}</h3>
                            <p className="text-sm text-muted-foreground">
                              {new Date(doc.uploadedAt).toLocaleDateString(
                                language === "ar" ? "ar-SA" : "en-US"
                              )}
                            </p>
                          </div>
                          <Badge
                            variant={
                              doc.status === "completed"
                                ? "success"
                                : doc.status === "error"
                                ? "destructive"
                                : doc.status === "processing"
                                ? "warning"
                                : "secondary"
                            }
                          >
                            {doc.status === "completed"
                              ? language === "ar"
                                ? "مكتمل"
                                : "Completed"
                              : doc.status === "error"
                              ? language === "ar"
                                ? "خطأ"
                                : "Error"
                              : doc.status === "processing"
                              ? language === "ar"
                                ? "قيد المعالجة"
                                : "Processing"
                              : language === "ar"
                              ? "معلق"
                              : "Pending"}
                          </Badge>
                        </div>
                        {doc.status === "error" && doc.errorMessage && (
                          <p className="text-sm text-red-500 mt-2">
                            {doc.errorMessage}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 text-muted-foreground">
                    {language === "ar"
                      ? "لم يتم تحميل أي مستندات بعد"
                      : "No documents uploaded yet"}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="preferences" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>
                {language === "ar" ? "تفضيلات المستخدم" : "User Preferences"}
              </CardTitle>
              <CardDescription>
                {language === "ar"
                  ? "قم بتخصيص إعدادات حسابك"
                  : "Customize your account settings"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h3 className="font-medium mb-2">
                    {language === "ar" ? "اللغة" : "Language"}
                  </h3>
                  <div className="flex space-x-2 rtl:space-x-reverse">
                    <Button
                      variant={language === "en" ? "default" : "outline"}
                      size="sm"
                      onClick={() => window.location.reload()}
                      disabled={language === "en"}
                    >
                      English
                    </Button>
                    <Button
                      variant={language === "ar" ? "default" : "outline"}
                      size="sm"
                      onClick={() => window.location.reload()}
                      disabled={language === "ar"}
                    >
                      العربية
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ProfilePage;