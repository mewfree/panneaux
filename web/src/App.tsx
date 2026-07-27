import { Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { CategoriesPage } from "./pages/CategoriesPage";
import { CategoryPage } from "./pages/CategoryPage";
import { HomePage } from "./pages/HomePage";
import { PanneauPage } from "./pages/PanneauPage";
import { SearchPage } from "./pages/SearchPage";

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="recherche" element={<SearchPage />} />
        <Route path="categories" element={<CategoriesPage />} />
        <Route path="categorie/:slug" element={<CategoryPage />} />
        <Route path="panneau/:codeSlug" element={<PanneauPage />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}

function NotFound() {
  return (
    <div className="space-y-2 py-16 text-center">
      <h1 className="text-2xl font-bold">Page introuvable</h1>
      <p className="text-slate-600">Cette adresse ne correspond à aucune page.</p>
    </div>
  );
}
