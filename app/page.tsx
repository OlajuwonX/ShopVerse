import { Heart, Search, ShoppingCart } from "lucide-react";

import { Money } from "@/components/commerce/Money";
import { Badge } from "@/components/ui/Badge";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Checkbox } from "@/components/ui/Checkbox";
import { Chip } from "@/components/ui/Chip";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { IconButton } from "@/components/ui/IconButton";
import { Input } from "@/components/ui/Input";
import { RetryState } from "@/components/ui/RetryState";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { Switch } from "@/components/ui/Switch";
import { Tabs } from "@/components/ui/Tabs";
import { Textarea } from "@/components/ui/Textarea";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-surface px-(--page-gutter) py-8 text-text">
      <div className="mx-auto grid w-full max-w-(--page-max) gap-8">
        <section className="grid gap-5" aria-labelledby="stage-title">
          <Breadcrumb
            items={[{ href: "/", label: "ShopVerse" }, { label: "Design system" }]}
          />
          <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
            <div className="grid gap-3">
              <Badge tone="brand">Stage 04</Badge>
              <h1
                id="stage-title"
                className="max-w-3xl text-heading-1 font-bold md:text-display"
              >
                Design tokens and UI primitives are ready.
              </h1>
              <p className="max-w-2xl text-body text-text-muted">
                This foundation keeps ShopVerse components consistent, accessible and
                cheap to deploy while later stages add real commerce data.
              </p>
            </div>
            <div className="flex gap-2">
              <IconButton aria-label="Search ShopVerse">
                <Search aria-hidden="true" className="size-5" />
              </IconButton>
              <IconButton aria-label="View wishlist" variant="ghost">
                <Heart aria-hidden="true" className="size-5" />
              </IconButton>
              <IconButton aria-label="View cart">
                <ShoppingCart aria-hidden="true" className="size-5" />
              </IconButton>
            </div>
          </div>
        </section>

        <Tabs
          items={[
            { href: "/", label: "Tokens", selected: true },
            { href: "/", label: "Forms" },
            { href: "/", label: "States" },
          ]}
          label="Design system sections"
        />

        <section
          className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]"
          aria-label="Primitive examples"
        >
          <Card className="grid gap-5 p-5">
            <SectionHeader
              action={<Button variant="secondary">View more</Button>}
              eyebrow="Commerce surface"
              title="Reusable controls"
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                hint="Labels are real labels, not placeholders."
                label="Search"
                name="search"
              />
              <Select label="Sort" name="sort" defaultValue="trending">
                <option value="trending">Trending</option>
                <option value="new">New arrivals</option>
                <option value="price">Price</option>
              </Select>
              <Textarea className="sm:col-span-2" label="Admin note" name="note" />
            </div>
            <div className="flex flex-wrap gap-2">
              <Chip selected>Trending</Chip>
              <Chip>Offers</Chip>
              <Chip>New arrivals</Chip>
              <Chip>Best sellers</Chip>
            </div>
            <div className="grid gap-3">
              <Checkbox label="Show available items only" />
              <Switch
                description="A styled checkbox keeps this primitive server-friendly."
                label="Compact view"
              />
            </div>
          </Card>

          <Card className="grid content-between gap-5 p-5">
            <div className="grid gap-3">
              <SectionHeader eyebrow="Pricing" title="Money uses minor units" />
              <p className="text-price-lg font-bold">
                <Money minorUnits={123400000} />
              </p>
              <div className="flex flex-wrap gap-2">
                <Badge tone="sale">Sale</Badge>
                <Badge tone="success">In stock</Badge>
                <Badge tone="warning">Low stock</Badge>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button>Shop now</Button>
              <Button variant="secondary">Add to cart</Button>
              <Button variant="danger">Remove</Button>
            </div>
          </Card>
        </section>

        <section className="grid gap-4 lg:grid-cols-3" aria-label="State examples">
          <EmptyState
            action={<Button variant="secondary">Shop now</Button>}
            description="Your cart is empty. Add a product when the catalogue is connected."
            title="Your cart is empty"
          />
          <RetryState description="This copy stays calm and gives the customer a clear next action." />
          <ErrorState
            correlationId="STAGE04-DEMO"
            description="The production version will show a traceable reference without exposing internals."
          />
        </section>

        <section
          aria-label="Skeleton examples"
          className="grid gap-3 rounded-lg border border-border p-5"
        >
          <p className="text-label font-bold text-text-muted">
            Layout-matching skeletons
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <Skeleton className="aspect-4/5" />
            <Skeleton className="aspect-4/5" />
            <Skeleton className="aspect-4/5" />
          </div>
        </section>
      </div>
    </main>
  );
}
