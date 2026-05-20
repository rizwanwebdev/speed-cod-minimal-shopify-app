// Helper: normalize Pakistan phone numbers to Shopify's canonical format
function normalizePkPhone(raw) {
  const digits = String(raw).replace(/\D/g, "");

  // Local mobile format 0309xxxxxxx (11 digits, starting with 0)
  if (digits.length === 11 && digits.startsWith("0")) {
    // Convert to 92 + rest: 92 309xxxxxxx
    return `92${digits.slice(1)}`;
  }

  // Already in 92xxxxxxxxxxx format
  if (digits.length === 12 && digits.startsWith("92")) {
    return digits;
  }

  // Fallback: return digits as-is
  return digits;
}

export default async function handler(req, res) {
  console.log("=== /api/create-order HIT ===", {
    method: req.method,
    query: req.query,
    time: new Date().toISOString(),
  });

  try {
    // 1. Basic validation
    if (req.method !== "POST") {
      console.warn("METHOD_NOT_ALLOWED", { method: req.method });
      return res.status(405).json({
        success: false,
        error: "METHOD_NOT_ALLOWED",
      });
    }

    const ENV_SHOP_NAME = process.env.SHOP_NAME;
    const ENV_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;

    console.log("Env check", {
      ENV_SHOP_NAME: !!ENV_SHOP_NAME,
      HAS_ACCESS_TOKEN: !!ENV_ACCESS_TOKEN,
    });

    const { shop, signature } = req.query;

    console.log("Incoming request params", {
      shop,
      signaturePresent: !!signature,
    });

    if (!shop || !signature || !shop.endsWith(".myshopify.com")) {
      console.warn("INVALID_PROXY_REQUEST", {
        shop,
        signaturePresent: !!signature,
      });
      return res.status(403).json({
        success: false,
        error: "INVALID_PROXY_REQUEST",
      });
    }

    if (shop !== ENV_SHOP_NAME) {
      console.warn("SHOP_MISMATCH", { shop, ENV_SHOP_NAME });
      return res.status(403).json({
        success: false,
        error: "SHOP_MISMATCH",
      });
    }

    if (!ENV_SHOP_NAME || !ENV_ACCESS_TOKEN) {
      console.error("SERVER_MISCONFIGURED", {
        ENV_SHOP_NAME,
        HAS_ACCESS_TOKEN: !!ENV_ACCESS_TOKEN,
      });
      return res.status(500).json({
        success: false,
        error: "SERVER_MISCONFIGURED",
      });
    }

    // 2. Parse body
    let body = req.body;
    if (typeof body === "string") {
      console.log("Parsing JSON body from string");
      body = JSON.parse(body);
    }

    console.log("Request body raw", body);

    const {
      name,
      phone,
      address,
      city,
      variantId,
      quantity,
      price,
      note,
    } = body || {};

    if (!name || !phone || !address || !city || !variantId || !quantity) {
      console.warn("MISSING_FIELDS", {
        hasName: !!name,
        hasPhone: !!phone,
        hasAddress: !!address,
        hasCity: !!city,
        hasVariantId: !!variantId,
        hasQuantity: !!quantity,
      });
      return res.status(400).json({
        success: false,
        error: "MISSING_FIELDS",
      });
    }

    const firstName = "";
    const lastName = name;
    const variantGid = `gid://shopify/ProductVariant/${variantId}`;

    // ✅ Normalize phone to Shopify's canonical format (e.g. "0309..." -> "92309...")
    const normalizedPhone = normalizePkPhone(phone);

    console.log("Normalized data", {
      firstName,
      lastName,
      variantGid,
      phone,
      normalizedPhone,
      quantity,
    });

    // 3. CUSTOMER LOOKUP BY PHONE (using normalizedPhone)
    const findCustomerByPhoneQuery = `
      query FindCustomerByPhone($query: String!) {
        customers(first: 1, query: $query) {
          edges {
            node {
              id
              defaultPhoneNumber {
                phoneNumber
              }
            }
          }
        }
      }
    `;

    const customerSearchQuery = `phone:"${normalizedPhone}"`;

    console.log("Customer lookup GraphQL request", {
      customerSearchQuery,
      endpoint: `https://${ENV_SHOP_NAME}/admin/api/2026-01/graphql.json`,
    });

    const customerLookupRes = await fetch(
      `https://${ENV_SHOP_NAME}/admin/api/2026-01/graphql.json`,
      {
        method: "POST",
        headers: {
          "X-Shopify-Access-Token": ENV_ACCESS_TOKEN,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: findCustomerByPhoneQuery,
          variables: { query: customerSearchQuery },
        }),
      },
    );

    console.log("Customer lookup response status", customerLookupRes.status);

    const customerLookupData = await customerLookupRes.json();
    console.log(
      "Customer lookup data:",
      JSON.stringify(customerLookupData, null, 2),
    );

    if (customerLookupData.errors) {
      console.error(
        "Customer lookup GraphQL errors",
        customerLookupData.errors,
      );
    }

    const customerEdges = customerLookupData?.data?.customers?.edges || [];
    const existingCustomer =
      customerEdges.length > 0 ? customerEdges[0].node : null;

    console.log("Customer lookup result", {
      found: !!existingCustomer,
      customerId: existingCustomer?.id || null,
      customerPhone: existingCustomer?.defaultPhoneNumber?.phoneNumber || null,
    });

    let customerId = existingCustomer?.id;

    // 5. CUSTOMER CREATION (if not exists) - Create with phone only
    if (!customerId) {
      console.log("No existing customer found. Creating new customer with phone only...");
      const customerCreateMutation = `
        mutation customerCreate($input: CustomerInput!) {
          customerCreate(input: $input) {
            customer {
              id
            }
            userErrors {
              field
              message
            }
          }
        }
      `;

      const customerInput = {
        firstName,
        lastName,
        phone: normalizedPhone,
      };

      const customerCreateRes = await fetch(
        `https://${ENV_SHOP_NAME}/admin/api/2026-01/graphql.json`,
        {
          method: "POST",
          headers: {
            "X-Shopify-Access-Token": ENV_ACCESS_TOKEN,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            query: customerCreateMutation,
            variables: { input: customerInput },
          }),
        },
      );

      const customerCreateData = await customerCreateRes.json();
      if (customerCreateData.data?.customerCreate?.customer?.id) {
        customerId = customerCreateData.data.customerCreate.customer.id;
        console.log("New customer created successfully:", customerId);
      } else {
        console.error("Customer creation failed:", customerCreateData.data?.customerCreate?.userErrors);
        // Fallback or handle error if needed. For now, we'll continue and see if orderCreate can handle it or fail gracefully.
      }
    }

    // 6. DUPLICATE CHECK (10-minute rule by customer + variant)
    if (customerId) {
      const TEN_MINUTES = 10 * 60 * 1000;
      const tenMinutesAgoDate = new Date(Date.now() - TEN_MINUTES);

      const duplicateQuery = `
        query CheckDuplicateOrder($query: String!) {
          orders(first: 5, query: $query, sortKey: CREATED_AT, reverse: true) {
            edges {
              node {
                id
                name
                createdAt
                lineItems(first: 10) {
                  edges {
                    node {
                      variant {
                        id
                      }
                    }
                  }
                }
              }
            }
          }
        }
      `;

      const customerNumericId = customerId.split("/").pop();
      const orderSearchQuery = `customer_id:${customerNumericId}`;

      const duplicateRes = await fetch(
        `https://${ENV_SHOP_NAME}/admin/api/2026-01/graphql.json`,
        {
          method: "POST",
          headers: {
            "X-Shopify-Access-Token": ENV_ACCESS_TOKEN,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            query: duplicateQuery,
            variables: { query: orderSearchQuery },
          }),
        },
      );

      const duplicateData = await duplicateRes.json();
      const existingOrders = duplicateData?.data?.orders?.edges || [];

      for (const edge of existingOrders) {
        const order = edge.node;
        const createdAtDate = new Date(order.createdAt);
        const hasSameVariant = order.lineItems.edges.some(
          (item) => item.node.variant?.id === variantGid,
        );
        const isWithin10Min = createdAtDate >= tenMinutesAgoDate;

        if (hasSameVariant && isWithin10Min) {
          return res.status(200).json({
            success: true,
            duplicate: true,
            message: "Order already placed within 10 minutes.",
            orderId: order.id,
            orderName: order.name,
          });
        }
      }
    }

    // 7. DYNAMIC PRICING LOGIC
    const qtyNum = Number(quantity);
    const passedPrice = Number(price);

    const lineItem = {
      variantId: variantGid,
      quantity: qtyNum,
      requiresShipping: true,
    };

    // Override price for quantity > 1 if a price was provided from the frontend
    if (qtyNum > 1 && passedPrice > 0) {
      // Calculate unit price: Shopify priceSet on line items is per-unit.
      const unitPrice = (passedPrice / qtyNum).toFixed(2);
      lineItem.priceSet = {
        shopMoney: {
          amount: unitPrice,
          currencyCode: "PKR",
        },
      };
    }

    const orderInput = {
      lineItems: [lineItem],
      customer: customerId
        ? {
          toAssociate: {
            id: customerId,
          },
        }
        : null, // Should have a customerId at this point
      shippingAddress: {
        firstName,
        lastName,
        phone,
        address1: address,
        city,
        countryCode: "PK",
      },
      billingAddress: {
        firstName,
        lastName,
        phone,
        address1: address,
        city,
        countryCode: "PK",
      },
      shippingLines: [
        {
          title: "Free Shipping",
          code: "Free Shipping",
          source: "Custom",
          priceSet: {
            shopMoney: {
              amount: 0.0,
              currencyCode: "PKR",
            },
          },
        },
      ],
      financialStatus: "PENDING",
    };

    if (note) {
      orderInput.note = String(note);
    }

    console.log(
      "Final orderInput to Shopify:",
      JSON.stringify(orderInput, null, 2),
    );

    const orderCreateMutation = `
      mutation orderCreate($order: OrderCreateOrderInput!) {
        orderCreate(order: $order) {
          userErrors {
            field
            message
          }
          order {
            id
            name
            displayFinancialStatus
          }
        }
      }
    `;

    const shopifyRes = await fetch(
      `https://${ENV_SHOP_NAME}/admin/api/2026-01/graphql.json`,
      {
        method: "POST",
        headers: {
          "X-Shopify-Access-Token": ENV_ACCESS_TOKEN,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: orderCreateMutation,
          variables: { order: orderInput },
        }),
      },
    );

    console.log("orderCreate response status", shopifyRes.status);

    const data = await shopifyRes.json();
    console.log(
      "Shopify orderCreate response data:",
      JSON.stringify(data, null, 2),
    );

    if (data.errors) {
      console.error("Top-level GraphQL errors", data.errors);
      return res.status(400).json({
        success: false,
        error: "GRAPHQL_ERROR",
        details: data.errors,
      });
    }

    const result = data.data?.orderCreate;

    if (!result || result.userErrors?.length) {
      console.warn("ORDER_CREATE_FAILED", {
        userErrors: result?.userErrors,
      });
      return res.status(400).json({
        success: false,
        error: "ORDER_CREATE_FAILED",
        details: result?.userErrors,
      });
    }

    console.log("Order created successfully", {
      orderId: result.order.id,
      displayFinancialStatus: result.order.displayFinancialStatus,
    });

    return res.status(200).json({
      success: true,
      duplicate: false,
      orderId: result.order.id,
      orderName: result.order.name,
      financialStatus: result.order.displayFinancialStatus,
      message: "Order placed successfully.",
    });
  } catch (err) {
    console.error("Handler error (catch)", err);
    return res.status(500).json({
      success: false,
      error: "INTERNAL_SERVER_ERROR",
      message: err.message,
    });
  }
}