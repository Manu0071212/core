"use client";

// apps/web/src/app/users/page.tsx
import { useState, useEffect } from "react";
import { Search, Mail } from "lucide-react";
import Link from "next/link";
import Header from "@/app/components/header";
import { users as usersApi, type User } from "@/lib/api";
import { useTranslation } from "react-i18next";

export default function UsersPage() {
  const { t } = useTranslation();
  const [userList, setUserList] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");

  const filterOptions = ["All", "Students", "Professors", "Technician"];

  useEffect(() => {
    usersApi.list()
      .then(setUserList)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filteredUsers = userList.filter((user) => {
    const matchesFilter = 
      activeFilter === "All" || 
      (activeFilter === "Students" && user.role === "student") ||
      (activeFilter === "Professors" && user.role === "professor") ||
      (activeFilter === "Technician" && user.role === "lab_technician");

    const matchesSearch = 
      user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (user.nmec ?? "").includes(searchQuery);

    return matchesFilter && matchesSearch;
  });

  return (
    <main className="flex-1 p-4 sm:p-8 bg-[#f4f5f7] min-h-screen font-sans text-gray-900">
      <Header />

      <div className="mb-6">
        <h1 className="text-2xl sm:text-[32px] font-bold text-gray-900 mb-0.5">{t("usersPage.title")}</h1>
        <p className="text-gray-500 text-sm font-medium">
          {loading ? t("common.loading") : t("usersPage.participants", { count: userList.length })}
        </p>
      </div>

      <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-4 mb-6 w-full">
        
        <div className="relative flex-1 w-full">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="w-full pl-12 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl outline-none text-sm text-gray-600 placeholder:text-gray-400 transition-all shadow-sm focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10"
            placeholder={t("usersPage.searchPlaceholder")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="flex flex-wrap gap-2 w-full lg:w-auto">
          {filterOptions.map((option) => {
            const label = option === "All" ? t("usersPage.all") : 
                         option === "Students" ? t("usersPage.studentsFilter") : 
                         option === "Professors" ? t("usersPage.professorsFilter") : 
                         t("usersPage.technicianFilter");
            
            return (
              <button
                key={option}
                onClick={() => setActiveFilter(option)}
                className={`px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap border transition-all shrink-0 ${
                  activeFilter === option
                    ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                    : "bg-white text-gray-500 border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {!loading && (
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 px-1">
            {t("usersPage.results", { count: filteredUsers.length })}
        </p>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white border border-transparent rounded-2xl p-6 h-32 animate-pulse shadow-sm" />
          ))}
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="bg-white p-4 rounded-full mb-4 shadow-sm border border-gray-100">
            <Search size={32} className="text-gray-300" />
          </div>
          <p className="text-gray-400 font-medium">{t("usersPage.noResults")}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredUsers.map((user) => (
            <Link
              key={user.id}
              href={`/users/${user.id}`}
              className="group bg-white border border-transparent hover:border-indigo-100 rounded-2xl p-4 sm:p-5 flex items-start gap-3 sm:gap-4 transition-all shadow-sm hover:shadow-md cursor-pointer"
            >
              <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center shrink-0 text-gray-400 font-bold text-[18px] group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors border border-gray-100 mt-0.5 sm:mt-0">
                {user.name.charAt(0).toUpperCase()}
              </div>

              <div className="flex flex-col gap-1 sm:gap-1.5 overflow-hidden w-full min-w-0">
                
                <div className="flex flex-col items-start gap-1 min-w-0 mb-0.5">
                  <h3 className="font-bold text-gray-900 text-base break-words line-clamp-2 group-hover:text-indigo-600 transition-colors min-w-0">
                    {user.name}
                  </h3>
                  
                  <div className="flex min-w-0">
                    <span className={`inline-block max-w-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider rounded-lg truncate sm:whitespace-normal sm:break-words ${
                      user.role === 'professor' ? 'bg-purple-50 text-purple-600' :
                      user.role === 'lab_technician' ? 'bg-emerald-50 text-emerald-600' :
                      'bg-indigo-50 text-indigo-600'
                    }`}>
                      {user.role === 'lab_technician' ? t("usersPage.staff") : user.role === 'student' ? t("usersPage.students") : t("usersPage.professors")}
                    </span>
                  </div>
                </div>
                
                <div className="flex items-start gap-1.5 text-[13px] text-gray-400 font-medium min-w-0">
                  <Mail size={12} className="shrink-0 text-gray-300 mt-1" />
                  <span className="break-all line-clamp-2 min-w-0">{user.email}</span>
                </div>
                
                {user.role === 'student' && user.nmec && (
                  <p className="text-[11px] text-gray-400 font-bold tracking-tight min-w-0">
                    {user.nmec}
                  </p>
                )}
                
                {user.course && (
                  <div className="flex items-start gap-2 mt-0.5 sm:mt-1 min-w-0">
                    <span className="inline-block max-w-full px-2 py-0.5 bg-gray-50 border border-gray-100 text-gray-400 text-[10px] font-bold rounded-lg uppercase min-w-0 truncate sm:whitespace-normal sm:line-clamp-2 sm:break-words text-left">
                      {user.course}
                    </span>
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}