# Site Exploration: Sauce Demo — https://www.saucedemo.com/
Explored: 2026-08-30, scope: login page (incl. login errors), inventory/products page, add-to-cart flow, cart page, full checkout flow (step one form + validation error, step two overview, complete confirmation), hamburger side menu, footer, one product detail page.

## Pages

### Login page — https://www.saucedemo.com/
Purpose: Username/password auth entry point for the whole app.
Key elements:
- textbox, name: "Username"
- textbox, name: "Password"
- button, name: "Login"
- heading (level 4), name: "Accepted usernames are:" — followed by plain text (not individually labeled elements): `standard_user`, `locked_out_user`, `problem_user`, `performance_glitch_user`, `error_user`, `visual_user`
- heading (level 4), name: "Password for all users:" — followed by plain text: `secret_sauce`
- On error: heading (level 3) containing a close button (icon-only `X`, ref only, no discovered accessible name/role text beyond "button") plus the error text as a text node inside the same heading, e.g. `"Epic sadface: Sorry, this user has been locked out."`

Notes: All 6 usernames share password `secret_sauce`. Only `locked_out_user` was verified to fail login (see Flows). The other named users (`problem_user`, `performance_glitch_user`, `error_user`, `visual_user`) are documented on the page as available but their specific broken behavior was not exercised in this pass — useful hooks for negative/edge-case stories, but their exact symptom is unconfirmed here.

### Products / inventory page — https://www.saucedemo.com/inventory.html
Purpose: Product catalog after login; add items to cart from here.
Key elements:
- button, name: "Open Menu" (hamburger, top-left) — reveals side nav
- img, name: "Open Menu" (icon inside the button)
- text: "Swag Labs" (header title, plain text generic node, not a heading)
- generic node holding the cart badge count (e.g. `"1"`) — plain text, not labeled; see cart icon caveat below
- text: "Products" (page heading area, plain text generic node, not an ARIA `heading`)
- combobox (sort dropdown), preceded by visible label text "Name (A to Z)" (current selection) — options:
  - option "Name (A to Z)" (default/selected)
  - option "Name (Z to A)"
  - option "Price (low to high)"
  - option "Price (high to low)"
- Per product card (6 products total), each renders:
  - link, name: "<Product Name>" wrapping an `img` with the same name (product image, links to `inventory-item.html?id=N`, href shown in snapshot as `"#"` since it's client-routed)
  - link, name: "<Product Name>" (second link, on the title text itself, same destination)
  - text: product description (plain text, not a distinct labeled element)
  - text: price, e.g. "$29.99"
  - button, name: "Add to cart" (per-item; becomes "Remove" after adding — same element, label text changes, `data-test` attribute changes from `add-to-cart-<slug>` to `remove-<slug>`)
- Products observed (name — price):
  - "Sauce Labs Backpack" — $29.99
  - "Sauce Labs Bike Light" — $9.99
  - "Sauce Labs Bolt T-Shirt" — $15.99
  - "Sauce Labs Fleece Jacket" — $49.99
  - "Sauce Labs Onesie" — $7.99
  - "Test.allTheThings() T-Shirt (Red)" — $15.99
- footer (see Footer section below)

Caveats:
- The cart icon itself (top-right, links to `cart.html`) is an `<a class="shopping_cart_link" data-test="shopping-cart-link">` wrapping only an SVG — it has **no accessible role/name** and does **not** appear as a `link` node in the accessibility snapshot at all (confirmed by targeted `browser_find` for "cart"/"shopping" turning up nothing, then clicking it via CSS selector `.shopping_cart_link` directly). `getByRole('link', {name: ...})` will NOT find it. The badge count next to it is a separate plain-text generic node (not a `status`/`badge` role), shows only when count > 0, and disappears entirely (not "0") when the cart is empty.
- "Products" and "Swag Labs" header text are plain generic nodes, not `heading` role elements — do not target them with `getByRole('heading', ...)`.

### Product detail page — https://www.saucedemo.com/inventory-item.html?id=N
Purpose: Single-product view, reached by clicking a product name/image link from inventory.
Key elements:
- button, name: "Open Menu"
- button (no discovered text label beyond containing img "Go back" + text "Continue"-style pattern), containing: img, name: "Go back" + text: "Back to products"
- img, name: "<Product Name>"
- text: "<Product Name>", description, price (e.g. "$29.99")
- button, name: "Add to cart" (same toggle-to-"Remove" behavior as inventory page)
Notes: URL uses a numeric `id` query param per product (e.g. `?id=4` for Sauce Labs Backpack); id values were not enumerated for all 6 products.

### Cart page — https://www.saucedemo.com/cart.html
Purpose: Review items added to cart before checkout.
Key elements:
- button, name: "Open Menu"
- text: "Your Cart" (plain generic node, not a heading role)
- text: "QTY", text: "Description" (column headers, plain text)
- Per cart row: text quantity (e.g. "1"), link name "<Product Name>", text description, text price, button name "Remove"
- button (icon + text): contains img name "Go back" and text "Continue Shopping" — accessible name likely concatenates to something like "Go back Continue Shopping"; treat as a single clickable button, match on visible text "Continue Shopping" via text locator if role/name matching is unreliable
- button, name: "Checkout"

### Checkout Step One (Your Information) — https://www.saucedemo.com/checkout-step-one.html
Purpose: Collect first name, last name, postal code before showing order summary.
Key elements:
- text: "Checkout: Your Information" (plain generic node)
- textbox, name: "First Name"
- textbox, name: "Last Name"
- textbox, name: "Zip/Postal Code"
- button (icon + text): img name "Go back" + text "Cancel"
- button, name: "Continue"
Validation: submitting with all fields empty produces an error inside a `heading` (level 3) element (same pattern as login errors — heading contains a close button plus the error text): verbatim text `"Error: First Name is required"`. (Only first-name emptiness was triggered/observed; last-name/postal-code-specific messages were not individually confirmed but the same heading/pattern is expected.)

### Checkout Step Two (Overview) — https://www.saucedemo.com/checkout-step-two.html
Purpose: Final review of items, pricing, and payment/shipping info before finishing.
Key elements:
- text: "Checkout: Overview" (plain generic node)
- text: "QTY", "Description" column headers
- Per item row: quantity, link name "<Product Name>", description, price
- text: "Payment Information:" followed by "SauceCard #31337"
- text: "Shipping Information:" followed by "Free Pony Express Delivery!"
- text: "Price Total" section: "Item total: $29.99", "Tax: $2.40", "Total: $32.39" (values observed for a single $29.99 backpack; tax rate ≈ 8%)
- button (icon + text): img name "Go back" + text "Cancel"
- button, name: "Finish"

### Checkout Complete — https://www.saucedemo.com/checkout-complete.html
Purpose: Order confirmation.
Key elements:
- text: "Checkout: Complete!" (plain generic node)
- img, name: "Pony Express"
- heading (level 2), name: "Thank you for your order!"
- text: "Your order has been dispatched, and will arrive just as fast as the pony can get there!"
- button, name: "Back Home" (returns to inventory.html; cart is emptied — badge disappears)
- button, name: "Generate PDF order"
Notes: Cart badge is fully absent from the header on this page (not shown as "0") both before and after clicking Back Home once cart is empty.

## Hamburger side menu (all pages, post-login)
Opened via button "Open Menu" (top-left); reveals:
- navigation region containing:
  - link, name: "All Items" (marked `[active]` in snapshot on some pages) — href "#", returns to inventory.html
  - link, name: "About" — href `https://saucelabs.com/` (external, real navigation)
  - link, name: "Logout" — href "#", ends session and returns to root login page (verified: confirmed logout via `data-test="logout-sidebar-link"`, lands back on https://www.saucedemo.com/)
  - link, name: "Reset App State" — href "#" (resets cart/app state; not exercised beyond noting its presence)
- button, name: "Close Menu" (closes the slide-out panel)
- img, name: "Close Menu" (icon inside the close button)

## Footer (all pages)
- contentinfo landmark containing a list of 3 social links:
  - link, name: "Twitter" — href `https://twitter.com/saucelabs`
  - link, name: "Facebook" — href `https://www.facebook.com/saucelabs`
  - link, name: "LinkedIn" — href `https://www.linkedin.com/company/sauce-labs/`
- text: "© 2026 Sauce Labs. All Rights Reserved. Terms of Service | Privacy Policy" (plain text, "Terms of Service" and "Privacy Policy" did not appear as separate link elements in the snapshot — likely plain text or the links weren't distinctly parsed; not independently verified as clickable).

## Flows

### Login — locked out user
1. Filled Username = `locked_out_user`, Password = `secret_sauce`, clicked button "Login".
2. Stayed on https://www.saucedemo.com/ (no navigation). Error shown in a `heading` (level 3) that also contains a close button:
   Verbatim: `"Epic sadface: Sorry, this user has been locked out."`

### Login — wrong password
1. Filled Username = `standard_user`, Password = `wrong_password`, clicked "Login".
2. Stayed on login page. Error text verbatim:
   `"Epic sadface: Username and password do not match any user in this service"`

### Login — standard user (success)
1. Filled Username = `standard_user`, Password = `secret_sauce`, clicked "Login".
2. Navigated to https://www.saucedemo.com/inventory.html.

### Add to cart
1. From inventory page, clicked "Add to cart" button on "Sauce Labs Backpack" ($29.99).
2. Button label changed in place from "Add to cart" to "Remove" (same element).
3. Cart badge (plain text node next to the icon-only cart link) appeared showing "1".

### View cart / checkout (full happy path, single item)
1. Clicked the cart icon (`.shopping_cart_link` — no accessible name, use CSS/data-test selector, not `getByRole`) → navigated to cart.html. Row shows qty "1", "Sauce Labs Backpack", "$29.99", button "Remove".
2. Clicked button "Checkout" → navigated to checkout-step-one.html.
3. Clicked "Continue" with all fields empty → error `"Error: First Name is required"` (heading level 3, same close-button pattern as login errors).
4. Filled First Name "Jane", Last Name "Doe", Zip/Postal Code "94107". Clicked "Continue" → navigated to checkout-step-two.html, showing item, "SauceCard #31337", "Free Pony Express Delivery!", "Item total: $29.99", "Tax: $2.40", "Total: $32.39".
5. Clicked "Finish" → navigated to checkout-complete.html: heading "Thank you for your order!", confirmation text, buttons "Back Home" and "Generate PDF order". Cart badge no longer present.
6. Clicked "Back Home" → returned to inventory.html; "Sauce Labs Backpack" button reverted to "Add to cart" (cart emptied), no cart badge shown.

### Hamburger menu / logout
1. Clicked "Open Menu" → side nav appeared with links "All Items", "About", "Logout", "Reset App State", and a "Close Menu" button.
2. Clicked "Logout" (`data-test="logout-sidebar-link"`) → navigated back to https://www.saucedemo.com/ (login page), session ended.

## Caveats / open questions
- The cart icon link (`.shopping_cart_link`, `data-test="shopping-cart-link"`) has **no accessible role/name** in the accessibility tree — Playwright `getByRole('link', ...)` cannot target it; test generation must fall back to a CSS/data-test/text-adjacent strategy or this element needs special-casing.
- Several icon+text buttons ("Continue Shopping", "Cancel", "Back to products") combine an `img` (e.g. alt "Go back") with visible text; exact concatenated accessible name was not empirically confirmed via a dedicated accessible-name query — treat name matching on these as slightly uncertain and prefer matching the visible text portion.
- `problem_user`, `performance_glitch_user`, `error_user`, `visual_user` were not logged in during this pass — their specific broken behaviors (known from general Sauce Demo lore: e.g. `problem_user` has broken images/can't complete checkout name changes, `performance_glitch_user` is slow, `error_user`/`visual_user` have assorted UI bugs) were not directly observed/verified here.
- Per-field validation errors for missing Last Name / missing Postal Code specifically (as opposed to First Name) were not individually triggered — only the empty-all-fields case (which surfaces the First Name error first) was confirmed.
- "Reset App State" menu link was not clicked/exercised.
- "Generate PDF order" button on the confirmation page was not clicked.
- Footer "Terms of Service" / "Privacy Policy" were not confirmed as separate interactive link elements.
- Sort dropdown options were read from the DOM but reordering behavior after selecting each option was not verified in this pass.
