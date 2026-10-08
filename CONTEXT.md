# Shop in Sweden

Helps people living in Denmark decide whether a car trip to Sweden to shop is worth it, by weighing what they'd save on their purchases against what the trip costs.

## Language

### The trip

**Shopping Trip**:
A same-day car journey on the **Trip Date** from the **Starting Point**, over one **Crossing**, to that crossing's **Destination** and back. Each **Crossing** gives a different Shopping Trip, and the cheaper one is recommended.
_Avoid_: Border trade, grænsehandel, tour

**Trip Date**:
The day the **Shopping Trip** happens. It decides which **Offers** are valid and which season's ferry prices apply. Defaults to the next Saturday.
_Avoid_: Travel date, departure

**Starting Point**:
Where in Denmark the shopper drives from, given as a Danish postcode.
_Avoid_: Home, origin, address

**Crossing**:
One of the supported ways to take a car between Denmark and Sweden: the Øresund Bridge or the Helsingør–Helsingborg ferry.
_Avoid_: Route, connection, link

**Destination**:
The one fixed shopping area in Sweden assumed for each **Crossing**: Hyllie/Emporia in Malmö for the bridge, Väla Centrum near Helsingborg for the ferry. Each Destination has a fixed list of **Stores**.
_Avoid_: Shop, mall, shopping centre

**Crossing Fee**:
What the shopper pays to use a **Crossing** for the round trip: the cheapest ticket anyone can buy without a subscription, unless the shopper has a **Discount Agreement**.
_Avoid_: Toll, ticket price, bridge price

**Discount Agreement**:
A subscription or prepaid product the shopper already has, which lowers their **Crossing Fee**: ØresundGO for the bridge, or AutoBizz or a multi-trip card (turkort) for the ferry. Its annual fee is not counted against the trip.
_Avoid_: Subscription, pass, BroPas

**Vehicle**:
The car making the **Shopping Trip**: up to 6 m and without a trailer, described by whether it runs on petrol or electricity and how much energy it uses per 100 km.
_Avoid_: Car type, profile

**Driving Cost**:
The energy cost (petrol or electricity) of driving the **Vehicle** from the **Starting Point** to the **Destination** and back, excluding the **Crossing** itself.
_Avoid_: Fuel cost, travel cost

**Trip Cost**:
The **Crossing Fee** plus the **Driving Cost**. Excludes the shopper's time.
_Avoid_: Total cost, expenses

### The shopping

**Category**:
A group of goods that shares one **Price Gap**. There are four: groceries, candy and snacks, soft drinks, and personal care and household.
_Avoid_: Product type, department

**Planned Spend**:
What the shopper expects to spend in a **Category**, valued at Danish prices in DKK.
_Avoid_: Budget, basket, amount

**Price Gap**:
How much cheaper a **Category** is at a **Destination** than in Denmark, as a percentage of the Danish price. Measured on the **Sample Basket** using the cheapest price available at the Destination's **Stores** and at the Danish **Retailers**, including **Offers**, at the current exchange rate. It is negative when the **Category** is dearer in Sweden.
_Avoid_: Discount, price difference, saving rate

**Sample Basket**:
The set of **Basket Items** per **Category** from which each **Price Gap** is measured.
_Avoid_: Index, price index, reference basket

**Basket Item**:
A kind of product, such as "whole milk" or "spaghetti", compared between the countries on its cheapest **Unit Price** in each country. Each **Basket Item** carries the same weight within its **Category**.
_Avoid_: Product, SKU, product pair

**Unit Price**:
A price per kilo, litre or piece, so that different pack sizes can be compared.
_Avoid_: Comparison price, kilo price

**Retailer**:
A supermarket chain we collect prices from, in Denmark or in Sweden. Danish prices come from Retailers nationally, not from particular **Stores**.
_Avoid_: Store, shop, chain

**Store**:
One particular branch of a Swedish **Retailer** at a **Destination**, such as Willys Emporia.
_Avoid_: Shop, branch, outlet

**Price Observation**:
One price for one product at one **Retailer**, with the date it applies from and where it came from. It is either a regular price or an **Offer**. Observations are kept, never overwritten.
_Avoid_: Price, price point, data point

**Offer**:
A temporary price from a **Retailer**'s weekly leaflet, valid between two dates. Multi-buy offers ("2 for 30 kr") count at their per-unit price. Member-only offers are not collected.
_Avoid_: Deal, campaign, discount, tilbud

**Lost Deposit**:
The Swedish deposit (pant) on a can or bottle, which a Danish shopper can't reclaim at home. It is added to the Swedish price of soft drinks.
_Avoid_: Pant, deposit, return fee

**Match Rule**:
The search words, pack-size range and excluded words that decide whether a product counts as a given **Basket Item**.
_Avoid_: Filter, mapping, matcher

### The result

**Gross Saving**:
The sum over all **Categories** of **Planned Spend** × **Price Gap**, plus any **Fill-up Saving**: what the shopper saves on goods alone.
_Avoid_: Discount, savings

**Fill-up Saving**:
What a petrol **Vehicle** saves by buying a chosen number of litres in Sweden rather than in Denmark. It is optional.
_Avoid_: Fuel saving, tank saving

**Net Saving**:
**Gross Saving** minus **Trip Cost**. The headline answer to "is the trip worth it?".
_Avoid_: Profit, savings, total

**Break-even Spend**:
The total **Planned Spend** at which **Net Saving** is zero for the shopper's mix of **Categories**.
_Avoid_: Minimum spend, threshold
