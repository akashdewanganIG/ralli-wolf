"use client";

import { productCategoryService, productService } from "@/lib/api/services";
import {
  CreateCategoryInput,
  CreateProductInput,
  Product,
  ProductCategory,
  UpdateProductInput,
} from "@/lib/api/types";
import { toast } from "@/lib/toast";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { Card, CardContent } from "@repo/ui/components/ui/card";
import { Checkbox } from "@repo/ui/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/ui/dialog";
import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";
import { PageHeader } from "@repo/ui/components/ui/page-header";
import { SearchInput } from "@repo/ui/components/ui/search-input";
import { Textarea } from "@repo/ui/components/ui/textarea";
import { SearchFilterToolbar } from "@repo/ui/components/ui/toolbar";
import {
  Check,
  ChevronsUpDown,
  Edit,
  Image as ImageIcon,
  Package,
  Plus,
  Search,
  Tag,
  X,
} from "@repo/ui/icons";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { DataTable } from "./data-table";
import {
  ProductFilter,
  ProductFilterValues,
  hasActiveProductFilters,
} from "./product-filter";
import { ProductFilterBadges } from "./product-filter-badges";
import { TablePageSkeleton } from "./skeletons";

import { useRouter } from "next/navigation";
import { ViewCategoriesModal } from "./ViewCategoriesModal";

export function ProductManagement() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isViewCategoriesModalOpen, setIsViewCategoriesModalOpen] =
    useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [categorySearchQuery, setCategorySearchQuery] = useState<string>("");
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const categoryDropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Filter and search state
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [filters, setFilters] = useState<ProductFilterValues>({
    categoryId: undefined,
    active: undefined,
  });

  const [productForm, setProductForm] = useState<CreateProductInput>({
    name: "",
    code: "",
    price: 0,
    description: "",
    categoryId: 0,
    active: false,
    component: false,
  });

  const [categoryForm, setCategoryForm] = useState<CreateCategoryInput>({
    name: "",
    description: "",
  });

  const fetchCategories = useCallback(async () => {
    try {
      const categoriesRes = await productCategoryService.getAllCategories();
      setCategories(categoriesRes.data || []);
    } catch (error: any) {
      toast.error(error.message || "Failed to fetch categories");
    }
  }, []);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const apiFilters: {
        categoryId?: number;
        active?: boolean;
        search?: string;
      } = {};

      if (filters.categoryId !== undefined) {
        apiFilters.categoryId = filters.categoryId;
      }

      if (filters.active !== undefined) {
        apiFilters.active = filters.active;
      }

      if (searchQuery.trim()) {
        apiFilters.search = searchQuery.trim();
      }

      const productsRes = await productService.getAllProducts(apiFilters);
      setProducts(productsRes.data || []);
    } catch (error: any) {
      toast.error(error.message || "Failed to fetch products");
    } finally {
      setLoading(false);
    }
  }, [searchQuery, filters]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  // Debounce search query to avoid too many API calls
  useEffect(() => {
    const timeoutId = setTimeout(
      () => {
        fetchData();
      },
      searchQuery ? 500 : 0
    ); // 500ms delay for search, immediate for filters

    return () => clearTimeout(timeoutId);
  }, [fetchData]);

  // Close category dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        categoryDropdownRef.current &&
        !categoryDropdownRef.current.contains(event.target as Node)
      ) {
        setIsCategoryDropdownOpen(false);
        setCategorySearchQuery("");
      }
    };

    if (isCategoryDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isCategoryDropdownOpen]);

  const handleCreateProduct = () => {
    setEditingProduct(null);
    setProductForm({
      name: "",
      code: "",
      price: 0,
      description: "",
      categoryId: 0,
      active: false,
      component: false,
    });
    setImagePreview(null);
    setSelectedImage(null);
    setCategorySearchQuery("");
    setIsCategoryDropdownOpen(false);
    setIsProductModalOpen(true);
  };

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    setProductForm({
      name: product.name,
      code: product.code,
      price:
        typeof product.price === "string"
          ? parseFloat(product.price)
          : product.price,
      description: product.description || "",
      categoryId: product.categoryId,
      active: product.active,
      component: product.component,
    });
    setImagePreview(product.imageUrl || null);
    setSelectedImage(null);
    setCategorySearchQuery("");
    setIsCategoryDropdownOpen(false);
    setIsProductModalOpen(true);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];

    if (!file) {
      return;
    }

    const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB (matches backend limit)
    if (file.size > MAX_FILE_SIZE) {
      toast.error("Product images must be 5MB or smaller.");
      e.target.value = "";
      return;
    }

    setSelectedImage(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    setSelectedImage(null);
    setImagePreview(editingProduct?.imageUrl || null);
  };

  const handleSubmitProduct = async () => {
    try {
      if (!productForm.name || !productForm.code || !productForm.categoryId) {
        toast.error("Please fill in all required fields");
        return;
      }

      setIsSubmitting(true);
      const formData: CreateProductInput | UpdateProductInput = {
        ...productForm,
        image: selectedImage || undefined,
      };

      if (editingProduct) {
        await productService.updateProduct(editingProduct.id, formData);
        toast.success("Product updated successfully");
      } else {
        await productService.createProduct(formData as CreateProductInput);
        toast.success("Product created successfully");
      }

      fetchData();
      setIsProductModalOpen(false);
      resetProductForm();
    } catch (error: any) {
      toast.error(error.message || "Failed to save product");
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetProductForm = () => {
    setProductForm({
      name: "",
      code: "",
      price: 0,
      description: "",
      categoryId: categories[0]?.id || 0,
      active: false,
      component: false,
    });
    setEditingProduct(null);
    setImagePreview(null);
    setSelectedImage(null);
    setCategorySearchQuery("");
    setIsCategoryDropdownOpen(false);
    setIsSubmitting(false);
  };

  const handleCreateCategory = async () => {
    try {
      if (!categoryForm.name) {
        toast.error("Category name is required");
        return;
      }

      await productCategoryService.createCategory(categoryForm);
      toast.success("Category created successfully");
      fetchCategories();
      fetchData();
      setCategoryForm({ name: "", description: "" });
      setIsCategoryModalOpen(false);
    } catch (error: any) {
      toast.error(error.message || "Failed to create category");
    }
  };

  if (loading) {
    return <TablePageSkeleton filters={1} rows={7} />;
  }

  return (
    <div className="app-page space-y-5">
      <PageHeader
        title="Product configuration"
        description="Manage products and the categories used throughout sales workflows."
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => setIsViewCategoriesModalOpen(true)}
            >
              <Tag className="h-4 w-4" />
              View Categories
            </Button>
            <Button
              variant="outline"
              onClick={() => setIsCategoryModalOpen(true)}
            >
              <Tag className="h-4 w-4" />
              Add Category
            </Button>
            <Button onClick={handleCreateProduct}>
              <Plus className="h-4 w-4" />
              Add Product
            </Button>
          </>
        }
      />

      {/* Products Table */}
      {products.length === 0 && !hasActiveProductFilters(filters) ? (
        <Card>
          <CardContent className="text-center py-12 text-muted-foreground">
            <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No products found. Create your first product to get started.</p>
          </CardContent>
        </Card>
      ) : (
        <DataTable<Product>
          data={products}
          columns={[
            {
              key: "imageUrl",
              label: "Image",
              render: (value, product) => (
                <div className="py-2">
                  {product.imageUrl ? (
                    <img
                      src={product.imageUrl}
                      alt={product.name}
                      className="w-12 h-12 object-cover rounded"
                    />
                  ) : (
                    <div className="w-12 h-12 bg-muted rounded flex items-center justify-center">
                      <ImageIcon className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}
                </div>
              ),
            },
            {
              key: "name",
              label: "Product Name",
              render: value => (
                <span className="font-medium text-muted-foreground py-4 text-center justify-center w-full pl-4">
                  {value}
                </span>
              ),
            },
            {
              key: "code",
              label: "Code",
              render: value => (
                <span className="text-muted-foreground py-4 text-center justify-center w-full pl-4">
                  {value}
                </span>
              ),
            },
            {
              key: "category",
              label: "Category",
              render: (value, product) => (
                <div className="py-4">
                  <Badge
                    variant="outline"
                    className="text-center justify-center px-2"
                  >
                    {product.category?.name || "N/A"}
                  </Badge>
                </div>
              ),
            },
            // {
            //   key: "price",
            //   label: "Price",
            //   render: (value, product) => (
            //     <span className="text-muted-foreground py-4">
            //       {product.price != null
            //         ? `₹${typeof product.price === 'string' ? parseFloat(product.price).toFixed(2) : product.price.toFixed(2)}`
            //         : <span className="text-muted-foreground">N/A</span>}
            //     </span>
            //   ),
            // },
            {
              key: "component",
              label: "Type",
              render: (value, product) => (
                <div className="py-4">
                  <Badge
                    variant="secondary"
                    className="text-center justify-center px-2"
                  >
                    {product.component ? "Component" : "Product"}
                  </Badge>
                </div>
              ),
            },
            {
              key: "active",
              label: "Status",
              render: (value, product) => (
                <div className="py-4 pl-4">
                  <Badge className="text-center justify-center px-2">
                    {product.active ? "Active" : "Inactive"}
                  </Badge>
                </div>
              ),
            },
          ]}
          getRowHref={product => `/sales/products/${product.id}`}
          title="All Products"
          count={products.length}
          searchQuery={searchQuery}
          isSearchMode={!!searchQuery}
          showFilter={true}
          customFilter={
            <SearchFilterToolbar
              className="min-w-0 flex-1 md:flex-nowrap"
              search={
                <SearchInput
                  placeholder="Search products by name, code, or description..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full"
                />
              }
              filters={
                <ProductFilter
                  filters={filters}
                  categories={categories}
                  onCategoryChange={categoryId =>
                    setFilters(prev => ({ ...prev, categoryId }))
                  }
                  onActiveChange={active =>
                    setFilters(prev => ({ ...prev, active }))
                  }
                />
              }
            />
          }
          filterBadges={
            <ProductFilterBadges
              filters={filters}
              categories={categories}
              onCategoryRemove={() =>
                setFilters(prev => ({ ...prev, categoryId: undefined }))
              }
              onActiveRemove={() =>
                setFilters(prev => ({ ...prev, active: undefined }))
              }
            />
          }
          customActions={product => (
            <div className="flex justify-start items-center gap-2">
              <Button
                variant="ghost"
                onClick={() => handleEditProduct(product)}
              >
                <Edit className="h-4 w-4" />
              </Button>
            </div>
          )}
        />
      )}

      {/* Product Modal */}
      <Dialog
        open={isProductModalOpen}
        onOpenChange={open => {
          setIsProductModalOpen(open);
          if (!open) {
            resetProductForm();
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingProduct ? "Edit Product" : "Create Product"}
            </DialogTitle>
            <DialogDescription>
              {editingProduct
                ? "Update product information"
                : "Add a new product to the catalog"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Image Upload */}
            <div className="space-y-2">
              <Label>Product Image</Label>
              <div className="flex items-center gap-4">
                {imagePreview ? (
                  <div className="relative">
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="w-32 h-32 object-cover rounded border"
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      className="absolute -top-2 -right-2"
                      onClick={handleRemoveImage}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="w-32 h-32 border-2 border-dashed rounded flex items-center justify-center">
                    <ImageIcon className="h-8 w-8 text-muted-foreground" />
                  </div>
                )}
                <div>
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="w-full sm:w-48"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    JPG, PNG, WebP (max 5MB)
                  </p>
                </div>
              </div>
            </div>

            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="name">
                Product Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                value={productForm.name}
                onChange={e =>
                  setProductForm({ ...productForm, name: e.target.value })
                }
                placeholder="Enter product name"
              />
            </div>

            {/* Code */}
            <div className="space-y-2">
              <Label htmlFor="code">
                Product Code <span className="text-destructive">*</span>
              </Label>
              <Input
                id="code"
                value={productForm.code}
                onChange={e =>
                  setProductForm({ ...productForm, code: e.target.value })
                }
                placeholder="Enter product code"
              />
            </div>

            {/* Category - Searchable */}
            <div className="space-y-2">
              <Label htmlFor="category">
                Category <span className="text-destructive">*</span>
              </Label>
              <div className="relative" ref={categoryDropdownRef}>
                <Button
                  type="button"
                  variant="outline"
                  role="combobox"
                  aria-expanded={isCategoryDropdownOpen}
                  className="w-full justify-between"
                  onClick={() =>
                    setIsCategoryDropdownOpen(!isCategoryDropdownOpen)
                  }
                >
                  {productForm.categoryId
                    ? categories.find(c => c.id === productForm.categoryId)
                        ?.name || "Select category..."
                    : "Select category..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
                {isCategoryDropdownOpen && (
                  <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-md">
                    <div className="p-2 border-b">
                      <div className="relative">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search categories..."
                          value={categorySearchQuery}
                          onChange={e => setCategorySearchQuery(e.target.value)}
                          className="pl-8"
                          onClick={e => e.stopPropagation()}
                        />
                      </div>
                    </div>
                    <div className="max-h-[12.5rem] overflow-y-auto p-1">
                      {categories
                        .filter(category =>
                          category.name
                            .toLowerCase()
                            .includes(categorySearchQuery.toLowerCase())
                        )
                        .map(category => (
                          <button
                            type="button"
                            key={category.id}
                            className={`relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-left text-sm outline-none hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring/30 ${
                              productForm.categoryId === category.id
                                ? "bg-accent text-accent-foreground"
                                : ""
                            }`}
                            onClick={() => {
                              setProductForm({
                                ...productForm,
                                categoryId: category.id,
                              });
                              setIsCategoryDropdownOpen(false);
                              setCategorySearchQuery("");
                            }}
                            aria-pressed={
                              productForm.categoryId === category.id
                            }
                          >
                            <Check
                              className={`mr-2 h-4 w-4 ${
                                productForm.categoryId === category.id
                                  ? "opacity-100"
                                  : "opacity-0"
                              }`}
                            />
                            {category.name}
                          </button>
                        ))}
                      {categories.filter(category =>
                        category.name
                          .toLowerCase()
                          .includes(categorySearchQuery.toLowerCase())
                      ).length === 0 && (
                        <div className="px-2 py-1.5 text-sm text-muted-foreground">
                          No categories found.
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={productForm.description}
                onChange={e =>
                  setProductForm({
                    ...productForm,
                    description: e.target.value,
                  })
                }
                placeholder="Enter product description"
                rows={4}
              />
            </div>

            {/* Active Status */}
            <div className="flex items-center space-x-2">
              <Checkbox
                id="active"
                checked={productForm.active}
                onCheckedChange={checked =>
                  setProductForm({ ...productForm, active: checked === true })
                }
              />
              <div className="grid gap-1.5 leading-none">
                <Label
                  htmlFor="active"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Active
                </Label>
                <p className="text-xs text-muted-foreground">
                  Product will be visible in Subdealers only when active
                </p>
              </div>
            </div>
            {/* Active Status */}
            <div className="flex items-center space-x-2">
              <Checkbox
                id="component"
                checked={productForm.component}
                onCheckedChange={checked =>
                  setProductForm({
                    ...productForm,
                    component: checked === true,
                  })
                }
              />
              <div className="grid gap-1.5 leading-none">
                <Label
                  htmlFor="Component"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Component
                </Label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsProductModalOpen(false);
                resetProductForm();
              }}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button onClick={handleSubmitProduct} disabled={isSubmitting}>
              {isSubmitting ? (
                <>{editingProduct ? "Updating..." : "Creating..."}</>
              ) : (
                <>{editingProduct ? "Update" : "Create"} Product</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Category Modal */}
      <Dialog open={isCategoryModalOpen} onOpenChange={setIsCategoryModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Category</DialogTitle>
            <DialogDescription>Add a new product category</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="categoryName">
                Category Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="categoryName"
                value={categoryForm.name}
                onChange={e =>
                  setCategoryForm({ ...categoryForm, name: e.target.value })
                }
                placeholder="Enter category name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="categoryDescription">Description</Label>
              <Textarea
                id="categoryDescription"
                value={categoryForm.description}
                onChange={e =>
                  setCategoryForm({
                    ...categoryForm,
                    description: e.target.value,
                  })
                }
                placeholder="Enter category description"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsCategoryModalOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleCreateCategory}>Create Category</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ViewCategoriesModal
        open={isViewCategoriesModalOpen}
        onOpenChange={setIsViewCategoriesModalOpen}
        categories={categories}
      />
    </div>
  );
}
