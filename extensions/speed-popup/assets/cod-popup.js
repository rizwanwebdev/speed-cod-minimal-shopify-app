document.addEventListener("DOMContentLoaded", () => {
  const btn = document.querySelector("#cod-btn");
  const btnBottom = document.querySelector(".cod-btn-bottom");
  const popup = document.querySelector("#cod-popup");
  const closeBtn = document.querySelector("#closeCodForm");
  const form = document.querySelector("#codOrderForm");
  const submitBtn = form?.querySelector('button[type="submit"]');
  const overlay = document.getElementById("cod-popup-container");
  const radios = document.querySelectorAll(".dynamic-radio");
  const priceDisplay = document.getElementById("dynamic-price");

  document.body.appendChild(overlay);
  document.body.appendChild(btnBottom);
  console.log(
    "%c For any web development or shopify related project hire me at contact@rizwanweb.site or check out my portfolio https://rizwanweb.site",
    "font-weight: bold; font-size: 14px;color: rgb(2,135,206); text-shadow: 3px 3px 0 rgb(2,135,206)  15px 15px 0 rgb(2,135,206) , 18px 18px 0 rgb(4,77,145) , 21px 21px 0 rgb(42,21,113)",
  );

  if (!btn || !popup || !form) {
    // console.error("Required COD elements not found");
    return;
  }
  radios.forEach((radio) => {
    radio.addEventListener("change", function () {
      if (this.checked) {
        priceDisplay.textContent = this.dataset.price;
      }
    });
  });

  function handleButtonPosition() {
    const windowWidth = window.innerWidth;

    if (windowWidth >= 768) {
      btnBottom.classList.remove("fixed-bottom");
      return;
    }

    const rect = btn.getBoundingClientRect();

    // If original button is above viewport
    if (rect.bottom < 60) {
      btnBottom.classList.add("fixed-bottom");
    } else {
      btnBottom.classList.remove("fixed-bottom");
    }
  }

  window.addEventListener("scroll", handleButtonPosition);
  window.addEventListener("resize", handleButtonPosition);

  const originalBtnText = submitBtn?.textContent || "Place Order";

  const messagePopup = document.querySelector("#message-popup");
  const messageText = document.querySelector("#message-text");
  const messageClose = document.querySelector("#message-close");
  const messageIcon = document.querySelector(".message-icon");
  const messageHeading = document.querySelector(".message-heading");
  document.body.appendChild(messagePopup);

  const successIcon = `
    <svg viewBox="0 0 24 24" width="50" height="50" fill="currentColor">
      <path d="M12 2C6.49 2 2 6.49 2 12s4.49 10 10 10 10-4.49 10-10S17.51 2 12 2zm4.78 7.7l-5.67 5.67a.75.75 0 0 1-1.06 0l-2.83-2.83a.75.75 0 1 1 1.06-1.06l2.3 2.3 5.14-5.14a.75.75 0 1 1 1.06 1.06z"/>
    </svg>
    `;
  const errorIcon = `
    <svg viewBox="0 0 24 24" width="50" height="50" fill="currentColor">
      <path d="M12 2C6.49 2 2 6.49 2 12s4.49 10 10 10 10-4.49 10-10S17.51 2 12 2zm3.53 13.53a.75.75 0 0 1-1.06 0L12 13.06l-2.47 2.47a.75.75 0 0 1-1.06-1.06L10.94 12 8.47 9.53a.75.75 0 1 1 1.06-1.06L12 10.94l2.47-2.47a.75.75 0 1 1 1.06 1.06L13.06 12l2.47 2.47a.75.75 0 0 1 0 1.06z"/>
    </svg>
    `;
  function showMessage(type, text) {
    messageText.textContent = text;

    const box = messagePopup.querySelector(".message-box");
    box.classList.remove("success", "error", "info");
    box.classList.add(type);
    // Inject correct icon
    if (type === "success") {
      messageIcon.innerHTML = successIcon;
      messageHeading.textContent = "Success";
    } else {
      messageIcon.innerHTML = errorIcon;
      messageHeading.textContent = "Error";
    }
    messagePopup.classList.add("show");
  }

  messageClose.addEventListener("click", () => {
    messagePopup.classList.remove("show");
  });

  // --- Meta Pixel Event Helper Functions ---

  // Function to track InitiateCheckout with retry logic
  function trackMetaPixelInitiateCheckoutWithRetry() {
    if (typeof fbq === "function") {
      // console.log("fbq defined for InitiateCheckout. Event sent.");
      // You can add parameters like value, currency, content_ids, etc., if they are known when the popup opens
      fbq("track", "InitiateCheckout");
    } else {
      // console.log("fbq not defined yet, retrying InitiateCheckout in 200ms...");
      setTimeout(trackMetaPixelInitiateCheckoutWithRetry, 200);
    }
  }

  // Function to track Purchase with retry logic
  function trackMetaPixelPurchaseWithRetry(formData, resultOrderId) {
    if (typeof fbq === "function") {
      // console.log("fbq defined for Purchase. Event sent.");
      const eventData = {
        value: parseFloat(formData.product_price || "0"),
        currency: "PKR",
        content_ids: [formData.variantId], // Assuming formData.variantId is available
        content_type: "product",
      };
      fbq("track", "Purchase", eventData);
      // console.log("Meta Pixel Purchase event fired with data:", eventData);
      // // Google Analytics tracking - moved here for consistency with fbq check
      // if (typeof gtag === "function") {
      //   gtag("event", "purchase", {
      //     transaction_id: resultOrderId,
      //     value: eventData.value,
      //     currency: eventData.currency,
      //   });
      //   // console.log("Google Analytics Purchase event fired.");
      // }
    } else {
      // console.log("fbq not defined yet, retrying Purchase track in 200ms...");
      setTimeout(
        () => trackMetaPixelPurchaseWithRetry(formData, resultOrderId),
        200,
      );
    }
  }
  // --- End Meta Pixel Event Helper Functions ---

  // Show popup - this is where we trigger the Initiate Checkout event
  function openPopup() {
    popup.classList.add("active");
    form.querySelector('input[name="name"]')?.focus();
    trackMetaPixelInitiateCheckoutWithRetry();
  }

  if (btn) {
    btn.addEventListener("click", openPopup);
  }

  if (btnBottom) {
    btnBottom.addEventListener("click", openPopup);
  }

  // Close popup (via closeBtn or outside click)
  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      popup.classList.remove("active");
      // form.reset();
    });
  }

  popup.addEventListener("click", (e) => {
    if (e.target === popup) {
      popup.classList.remove("active");
      // form.reset(); // Also reset form if closed this way
    }
  });

  // Close popup on Escape
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && popup.classList.contains("active")) {
      popup.classList.remove("active");
      // form.reset(); // Also reset form if closed this way
    }
  });

  const autoFillBtn = document.getElementById("auto-fill-address");

  autoFillBtn.addEventListener("click", getUserAddress);
  let userLatitude = null;
  let userLongitude = null;
  async function getUserAddress() {
    const addressField = document.getElementById("cod-address");
    const cityField = document.getElementById("cod-city");

    if (!navigator.geolocation) {
      alert("Geolocation is not supported.");
      return;
    }

    autoFillBtn.disabled = true;
    autoFillBtn.textContent = "Waiting For Permission...";

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        let seconds = 10;

        autoFillBtn.textContent = `Getting Address... (${seconds}s)`;

        // Start countdown AFTER permission + GPS success
        const countdown = setInterval(() => {
          seconds--;

          if (seconds > 0) {
            autoFillBtn.textContent = `Getting Address... (${seconds}s)`;
          }
        }, 1000);

        try {
          const { latitude, longitude } = position.coords;
          userLatitude = latitude;
          userLongitude = longitude;

          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`
          );

          const data = await response.json();

          console.log("Location Response:", data);

          // Full address
          const fullAddress = data.display_name || "";

          // Better city fallback handling
          const city =
            data.address.city ||
            data.address.town ||
            data.address.village ||
            data.address.municipality ||
            data.address.county ||
            "";

          // Fill fields
          if (addressField) {
            addressField.value = `${fullAddress} / ${latitude},${longitude} `;
          }

          if (cityField) {
            cityField.value = city;
          }

          clearInterval(countdown);

          autoFillBtn.textContent = "Address Filled";
        } catch (error) {
          console.error(error);

          clearInterval(countdown);

          autoFillBtn.textContent = "Failed To Fetch";
        } finally {
          autoFillBtn.disabled = false;

          setTimeout(() => {
            autoFillBtn.textContent = "Auto Fill Address";
          }, 2000);
        }
      },
      (error) => {
        console.error(error);

        let message = "Unable to get location.";

        switch (error.code) {
          case error.PERMISSION_DENIED:
            message = "Location permission denied.";
            break;

          case error.POSITION_UNAVAILABLE:
            message = "Location unavailable.";
            break;

          case error.TIMEOUT:
            message = "Location request timed out.";
            break;
        }

        alert(message);

        autoFillBtn.disabled = false;
        autoFillBtn.textContent = "Location Failed";

        setTimeout(() => {
          autoFillBtn.textContent = "Auto Fill Address";
        }, 2000);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const formData = Object.fromEntries(new FormData(form).entries());

    // Basic validation
    // Add quantity only if it doesn't exist
    if (!("quantity" in formData) || !formData.quantity) {
      formData.quantity = 1;
    }
    if (userLatitude && userLongitude) {
      formData.note = `${userLatitude},${userLongitude}`;
    } else {
      formData.note = "";
    }

    if (!formData.name || !formData.phone || !formData.address) {
      showMessage("error", "Please fill in all required fields");
      return;
    }

    if (formData.phone.length < 10) {
      showMessage("error", "Please enter a valid phone number");
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Processing...";
    }

    try {
      const res = await fetch("/apps/cod", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(formData),
      });

      let result;
      try {
        result = await res.json();
      } catch (parseError) {
        const text = await res.text().catch(() => "");
        // console.log("Raw response text:", text);
        // console.error("Failed to parse JSON from server:", parseError);
        throw new Error(`Server returned invalid data. Status: ${res.status}`);
      }

      // Handle success/error based on JSON + HTTP status
      if (!res.ok || !result.success) {
        let errorMsg =
          result?.message || result?.error || "Order failed. Please try again.";
        if (
          Array.isArray(result?.details) &&
          result.details.length > 0 &&
          result.details[0].message
        ) {
          errorMsg += `: ${result.details[0].message}`;
        }
        showMessage("error", errorMsg);
        return;
      }

      // Success
      const successMsg =
        result.message ||
        (result.orderId
          ? `Order #${result.orderId} placed successfully!`
          : "Order placed successfully!");

      showMessage("success", successMsg);

      // Trigger Purchase event after successful order
      trackMetaPixelPurchaseWithRetry(formData, result.orderId);

      popup.classList.remove("active");
      form.reset();
    } catch (err) {
      // console.error("FULL ERROR:", err);

      let userMessage = "Network error. Please check your connection.";
      if (err.message.includes("Failed to fetch")) {
        userMessage = "Unable to reach server. Please try again.";
      } else if (err.message.includes("Empty response")) {
        userMessage = "Server returned no data. Please try again.";
      } else if (err.message.includes("invalid data")) {
        userMessage = "Server error. Please try again later.";
      } else if (err.message) {
        userMessage = err.message;
      }

      showMessage("error", userMessage);
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = originalBtnText;
      }
    }
  });

  // Phone input formatting – only digits
  const phoneInput = form.querySelector('input[name="phone"]');
  if (phoneInput) {
    phoneInput.addEventListener("input", (e) => {
      e.target.value = e.target.value.replace(/\D/g, "");
    });
  }
});
