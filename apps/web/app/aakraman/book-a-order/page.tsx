"use client";

import logov3 from "@/app/assets/images/logos/logo_v1.png";
import {
  AakramanOrderFirmDetails,
  AakramanProduct,
  aakramanService,
  AakramanUser,
} from "@/lib/api/services";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { Card, CardContent } from "@repo/ui/components/ui/card";
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
import {
  ArrowLeft,
  CheckCircle,
  Package,
  ShoppingCart,
  Trash2,
  User,
} from "@repo/ui/icons";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";

// Local storage keys
const CART_STORAGE_KEY = "aakraman_cart";
const CUSTOMER_DETAILS_KEY = "aakraman_customer_details";

interface CartItem {
  product: AakramanProduct;
  quantity: number;
}

// Zod schema for quantity validation
const quantitySchema = z
  .number()
  .int()
  .positive("Quantity must be greater than zero");

export default function BookAOrderPage() {
  const router = useRouter();
  const [user, setUser] = useState<AakramanUser | null>(null);
  const [products, setProducts] = useState<AakramanProduct[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCart, setShowCart] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [orderNumber, setOrderNumber] = useState("");
  const [error, setError] = useState("");
  const [quantityInputs, setQuantityInputs] = useState<Record<number, string>>(
    {}
  );
  const [quantityErrors, setQuantityErrors] = useState<Record<number, string>>(
    {}
  );
  const [cartQuantityInputs, setCartQuantityInputs] = useState<
    Record<number, string>
  >({});
  const [cartQuantityErrors, setCartQuantityErrors] = useState<
    Record<number, string>
  >({});

  // Firm details from localStorage
  const [firmDetails, setFirmDetails] =
    useState<AakramanOrderFirmDetails | null>(null);

  // Load cart from localStorage
  useEffect(() => {
    const savedCart = localStorage.getItem(CART_STORAGE_KEY);
    if (savedCart) {
      try {
        setCart(JSON.parse(savedCart));
      } catch (e) {
        console.error("Failed to parse cart from localStorage:", e);
      }
    }
  }, []);

  // Save cart to localStorage whenever it changes
  useEffect(() => {
    if (cart.length > 0) {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    }
  }, [cart]);

  // Check authentication and load data
  useEffect(() => {
    const init = async () => {
      if (!aakramanService.isAuthenticated()) {
        router.push("/aakraman");
        return;
      }

      // Check if customer details exist
      const savedDetails = localStorage.getItem(CUSTOMER_DETAILS_KEY);
      if (!savedDetails) {
        router.push("/aakraman/customer-details");
        return;
      }

      try {
        const parsedDetails = JSON.parse(savedDetails);
        setFirmDetails(parsedDetails);

        const [userRes, productsRes] = await Promise.all([
          aakramanService.getCurrentUser(),
          aakramanService.getProducts(),
        ]);
        setUser(userRes.user);
        setProducts(productsRes.products);
      } catch (err: any) {
        console.error("Failed to load data:", err);
        if (err.response?.status === 401) {
          aakramanService.removeToken();
          router.push("/aakraman");
        }
      } finally {
        setIsLoading(false);
      }
    };

    init();
  }, [router]);

  // All products (no filtering, no grouping)
  const filteredProducts = useMemo(() => {
    return products;
  }, [products]);

  // Cart total items
  const cartTotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.quantity, 0);
  }, [cart]);

  const addToCart = (product: AakramanProduct, quantity: number) => {
    // Validate quantity
    const validationResult = quantitySchema.safeParse(quantity);
    if (!validationResult.success) {
      setQuantityErrors(prev => ({
        ...prev,
        [product.id]:
          validationResult.error.issues[0]?.message || "Invalid quantity",
      }));
      return;
    }

    // Clear error for this product
    setQuantityErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[product.id];
      return newErrors;
    });

    // Add or update cart
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        return prev.map(item =>
          item.product.id === product.id
            ? { ...item, quantity: validationResult.data }
            : item
        );
      }
      return [...prev, { product, quantity: validationResult.data }];
    });

    // Clear quantity input for this product
    setQuantityInputs(prev => {
      const newInputs = { ...prev };
      delete newInputs[product.id];
      return newInputs;
    });
  };

  const updateCartQuantity = (productId: number, quantity: number) => {
    // Validate quantity
    const validationResult = quantitySchema.safeParse(quantity);
    if (!validationResult.success) {
      setCartQuantityErrors(prev => ({
        ...prev,
        [productId]:
          validationResult.error.issues[0]?.message || "Invalid quantity",
      }));
      return;
    }

    // Clear error for this product
    setCartQuantityErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[productId];
      return newErrors;
    });

    // Update cart quantity
    setCart(prev => {
      return prev.map(item =>
        item.product.id === productId
          ? { ...item, quantity: validationResult.data }
          : item
      );
    });

    // Clear quantity input for this product
    setCartQuantityInputs(prev => {
      const newInputs = { ...prev };
      delete newInputs[productId];
      return newInputs;
    });
  };

  const removeFromCart = (productId: number) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
  };

  const getCartItemQuantity = (productId: number): number => {
    const item = cart.find(item => item.product.id === productId);
    return item?.quantity || 0;
  };

  const handlePlaceOrder = async () => {
    if (cart.length === 0) {
      setError("Your cart is empty");
      return;
    }
    if (!firmDetails) {
      router.push("/aakraman/customer-details");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const response = await aakramanService.createOrder({
        firmDetails,
        lineItems: cart.map(item => ({
          productId: item.product.id,
          quantity: item.quantity,
        })),
      });

      // Clear cart from local storage
      localStorage.removeItem(CART_STORAGE_KEY);
      setCart([]);
      setOrderNumber(response.data.orderNumber);

      // Close cart modal and open success modal
      setShowCart(false);
      setShowSuccessModal(true);
    } catch (err: any) {
      setError(
        err.response?.data?.error || "Failed to place order. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBack = () => {
    // Clear customer details to allow editing
    localStorage.removeItem(CUSTOMER_DETAILS_KEY);
    router.push("/aakraman/customer-details");
  };

  const handleBookAnotherOrder = () => {
    setShowSuccessModal(false);
    setOrderNumber("");
    setError("");

    // Clear customer details to start fresh
    localStorage.removeItem(CUSTOMER_DETAILS_KEY);

    router.push("/aakraman/customer-details");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-elevated">
        <div className="text-center">
          <p className="mt-4 text-text-secondary">Loading products...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-elevated pb-24">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-primary shadow-md">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 py-2 sm:py-3">
          <div className="flex items-center justify-between gap-2 sm:gap-4">
            {/* Back Button and Logo */}
            <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
              <button
                type="button"
                onClick={handleBack}
                className="rounded-lg bg-surface/90 p-2 shadow-sm transition-[background-color,box-shadow] duration-200 hover:bg-surface hover:shadow-md sm:p-2.5 whitespace-nowrap"
                aria-label="Back to customer details"
              >
                <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5 text-foreground" />
              </button>
              <div className="h-10 sm:h-12 md:h-14 flex items-center justify-center">
                <Image
                  src={logov3}
                  alt="Aakraman Logo"
                  width={200}
                  height={75}
                  className="object-contain h-full w-auto"
                />
              </div>
            </div>

            {/* User Name and Cart */}
            <div className="flex items-center gap-2 sm:gap-3">
              {user && (
                <div className="flex items-center gap-2 px-2 sm:px-3 py-1.5 rounded-lg bg-surface/90">
                  <User className="w-4 h-4 text-foreground/70" />
                  <p className="text-xs sm:text-sm font-medium text-foreground/90 whitespace-nowrap">
                    {user.firstName} {user.lastName}
                  </p>
                </div>
              )}

              <button
                type="button"
                onClick={() => setShowCart(true)}
                className="relative rounded-lg bg-surface/90 p-2 shadow-sm transition-[background-color,box-shadow] duration-200 hover:bg-surface hover:shadow-md sm:p-2.5"
                aria-label="Shopping cart"
              >
                <ShoppingCart className="w-4 h-4 sm:w-5 sm:h-5 text-foreground" />
                {cartTotal > 0 && (
                  <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-xs font-semibold w-4 h-4 sm:w-5 sm:h-5 rounded-full flex items-center justify-center shadow-md text-[0.625rem] sm:text-xs">
                    {cartTotal}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Products Grid */}
      <main className="max-w-7xl mx-auto px-3 py-2 mt-4">
        {filteredProducts.length === 0 ? (
          <div className="text-center py-12 sm:py-16 md:py-20">
            <Package className="w-16 h-16 sm:w-20 sm:h-20 text-text-disabled mx-auto" />
            <p className="mt-4 text-muted-foreground text-sm sm:text-base">
              No products found
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4 md:gap-4">
            {filteredProducts.map(product => {
              const qty = getCartItemQuantity(product.id);
              return (
                <Card
                  key={product.id}
                  className="flex h-full flex-col overflow-hidden bg-surface transition-shadow duration-300 hover:shadow-xl"
                >
                  {/* Product Image with Gradient Background */}
                  <div className="relative h-30 ">
                    {product.imageUrl ? (
                      <div className="absolute inset-0 flex items-center justify-center p-2">
                        <Image
                          src={product.imageUrl}
                          alt={product.name}
                          width={200}
                          height={200}
                          className="object-contain max-h-full max-w-full"
                        />
                      </div>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package className="w-16 h-16 text-warning-foreground/50" />
                      </div>
                    )}
                  </div>

                  {/* Product Details */}
                  <CardContent className="p-2 flex flex-col flex-1">
                    {/* Product Code as Badge */}
                    <div className="flex flex-wrap gap-1">
                      <Badge
                        variant="secondary"
                        className="text-xs mb-1 sm:text-[0.625rem] md:text-xs bg-surface-secondary text-text-secondary hover:bg-surface-secondary"
                      >
                        {product.code}
                      </Badge>
                    </div>

                    {/* Product Name - Bold and Prominent */}
                    <h3 className="font-bold text-sm sm:text-base mb-2 md:text-[0.9375rem]  line-clamp-2 text-foreground leading-tight">
                      {product.name}
                    </h3>

                    {/* Product Description */}
                    {product.description && (
                      <p className="text-xs sm:text-[0.6875rem] md:text-xs text-text-secondary mb-3 sm:mb-4 line-clamp-2 sm:line-clamp-3 flex-1">
                        {product.description}
                      </p>
                    )}

                    {/* Quantity Input and Add to Cart */}
                    <div className="mt-z space-y-2">
                      <div>
                        <Label
                          htmlFor={`quantity-${product.id}`}
                          className="text-xs sm:text-[0.6875rem] md:text-xs text-text-secondary font-medium"
                        >
                          Quantity
                        </Label>
                        <Input
                          id={`quantity-${product.id}`}
                          type="text"
                          inputMode="numeric"
                          value={
                            quantityInputs[product.id] ??
                            (qty > 0 ? qty.toString() : "")
                          }
                          onChange={e => {
                            const value = e.target.value;
                            setQuantityInputs(prev => ({
                              ...prev,
                              [product.id]: value,
                            }));
                            // Clear error when user starts typing
                            if (quantityErrors[product.id]) {
                              setQuantityErrors(prev => {
                                const newErrors = { ...prev };
                                delete newErrors[product.id];
                                return newErrors;
                              });
                            }
                          }}
                          placeholder="Enter quantity"
                          size="sm"
                          className="mt-1"
                        />
                        {quantityErrors[product.id] && (
                          <p className="text-[0.625rem] sm:text-xs text-destructive mt-1">
                            {quantityErrors[product.id]}
                          </p>
                        )}
                      </div>
                      <Button
                        onClick={() => {
                          const inputValue =
                            quantityInputs[product.id] ??
                            (qty > 0 ? qty.toString() : "");
                          const parsedQuantity =
                            inputValue === ""
                              ? 0
                              : Number.parseInt(inputValue, 10);
                          if (isNaN(parsedQuantity)) {
                            setQuantityErrors(prev => ({
                              ...prev,
                              [product.id]: "Please enter a valid number",
                            }));
                            return;
                          }
                          addToCart(product, parsedQuantity);
                        }}
                        size="sm"
                        className="w-full bg-primary hover:bg-primary text-foreground font-semibold"
                      >
                        <ShoppingCart className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />{" "}
                        Add to Cart
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>

      {/* Floating Cart Button (Mobile) */}
      {cartTotal > 0 && (
        <div className="fixed bottom-4 left-3 right-3 sm:left-4 sm:right-4 lg:hidden z-50">
          <Button
            onClick={() => setShowCart(true)}
            className="w-full bg-foreground text-background py-3 sm:py-4 rounded-xl shadow-lg text-sm sm:text-base font-semibold"
          >
            <ShoppingCart className="w-5 h-5" />
            View Cart ({cartTotal} items)
          </Button>
        </div>
      )}

      {/* Cart Slide-over */}
      <Dialog
        open={showCart}
        onOpenChange={open => !isSubmitting && setShowCart(open)}
      >
        <DialogContent className="w-[95vw] sm:max-w-md max-h-[90vh] overflow-y-auto">
          {/* Loading Overlay */}
          {isSubmitting && (
            <div className="absolute inset-0 bg-surface/90 flex items-center justify-center rounded-lg">
              <div className="text-center">
                <p className="mt-3 text-sm font-medium text-text-secondary">
                  Placing your order...
                </p>
              </div>
            </div>
          )}

          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5" />
              Your Cart ({cartTotal} items)
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-4">
            {cart.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Your cart is empty
              </p>
            ) : (
              cart.map(item => (
                <div
                  key={item.product.id}
                  className="flex items-center gap-3 p-3 bg-surface-elevated rounded-lg"
                >
                  <div className="w-16 h-16 relative bg-active rounded flex-shrink-0">
                    {item.product.imageUrl ? (
                      <Image
                        src={item.product.imageUrl}
                        alt={item.product.name}
                        fill
                        className="object-cover rounded"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package className="w-8 h-8 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground">
                      {item.product.code}
                    </p>
                    <p className="font-medium text-sm truncate">
                      {item.product.name}
                    </p>
                    <div className="mt-1">
                      <Label
                        htmlFor={`cart-quantity-${item.product.id}`}
                        className="text-xs text-text-secondary font-medium"
                      >
                        Quantity
                      </Label>
                      <Input
                        id={`cart-quantity-${item.product.id}`}
                        type="text"
                        inputMode="numeric"
                        value={
                          cartQuantityInputs[item.product.id] ??
                          item.quantity.toString()
                        }
                        onChange={e => {
                          const value = e.target.value;
                          setCartQuantityInputs(prev => ({
                            ...prev,
                            [item.product.id]: value,
                          }));
                          // Clear error when user starts typing
                          if (cartQuantityErrors[item.product.id]) {
                            setCartQuantityErrors(prev => {
                              const newErrors = { ...prev };
                              delete newErrors[item.product.id];
                              return newErrors;
                            });
                          }
                        }}
                        onBlur={e => {
                          const inputValue = e.target.value;
                          const parsedQuantity =
                            inputValue === ""
                              ? 0
                              : Number.parseInt(inputValue, 10);
                          if (isNaN(parsedQuantity)) {
                            setCartQuantityErrors(prev => ({
                              ...prev,
                              [item.product.id]: "Please enter a valid number",
                            }));
                            return;
                          }
                          updateCartQuantity(item.product.id, parsedQuantity);
                        }}
                        placeholder="Enter quantity"
                        size="sm"
                        className="mt-1"
                      />
                      {cartQuantityErrors[item.product.id] && (
                        <p className="text-[0.625rem] sm:text-xs text-destructive mt-1">
                          {cartQuantityErrors[item.product.id]}
                        </p>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeFromCart(item.product.id)}
                    className="p-2 text-destructive hover:bg-error-surface rounded whitespace-nowrap"
                    aria-label={`Remove ${item.product.name} from cart`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
          {error && (
            <div className="mt-4 p-3 bg-error-surface border border-error-border rounded-lg">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}
          {cart.length > 0 && (
            <DialogFooter className="mt-4">
              <Button
                onClick={handlePlaceOrder}
                disabled={isSubmitting}
                className="w-full bg-primary hover:bg-primary text-foreground font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? <>Placing Order...</> : "Book Order"}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* Success Modal */}
      <Dialog open={showSuccessModal} onOpenChange={setShowSuccessModal}>
        <DialogContent className="w-[95vw] sm:max-w-md text-center">
          <div className="flex flex-col items-center py-4">
            <div className="w-20 h-20 bg-success-surface rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="w-12 h-12 text-success-foreground" />
            </div>
            <DialogTitle className="text-2xl">Order Placed!</DialogTitle>
            <DialogDescription className="mt-2">
              Your order has been successfully placed.
            </DialogDescription>
            <div className="mt-4 p-4 bg-surface-secondary rounded-lg">
              <p className="text-sm text-muted-foreground">Order Number</p>
              <p className="text-xl font-bold">{orderNumber}</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 mt-4 w-full">
              <Button
                onClick={handleBookAnotherOrder}
                className="flex-1 bg-primary hover:bg-primary text-foreground font-semibold"
              >
                Book Another Order
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
