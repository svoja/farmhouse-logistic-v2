import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  fetchRoutes,
  fetchRouteStops,
  fetchCars,
  fetchEmployees,
  fetchProducts,
  fetchBranchCategories,
  fetchRetailersByDc,
  calculateAllocation,
  createShipment,
} from '../api';

const STEPS = ['Route', 'Vehicle & Crew', 'DCs', 'Retailers', 'Items', 'Submit'];

export default function CreateOrderPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const [routes, setRoutes] = useState([]);
  const [routeStops, setRouteStops] = useState([]);
  const [cars, setCars] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [sales, setSales] = useState([]);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);

  const [routeId, setRouteId] = useState('');
  const [carId, setCarId] = useState('');
  const [driverId, setDriverId] = useState('');
  const [salesId, setSalesId] = useState('');
  const [selectedDcIds, setSelectedDcIds] = useState(new Set());
  const [retailersByDc, setRetailersByDc] = useState({});
  const [selectedRetailerIds, setSelectedRetailerIds] = useState(new Set());
  const [quantities, setQuantities] = useState({});
  const [allocating, setAllocating] = useState(false);
  const [saving, setSaving] = useState(false);

  const dcCatId = (categories.find((c) => (c.name || '').toLowerCase().includes('dc') || (c.name || '').toLowerCase().includes('distribution')) || {}).cat_id ?? 2;
  const dcsOnRoute = routeStops.filter((s) => s.cat_id === dcCatId);
  const includedDcIds = dcsOnRoute.filter((d) => selectedDcIds.has(d.branch_id)).map((d) => d.branch_id);

  useEffect(() => {
    Promise.all([
      fetchRoutes(),
      fetchCars({ available: true }),
      fetchEmployees({ job_title: 'Driver' }),
      fetchEmployees({ job_title: 'Sales' }),
      fetchProducts(),
      fetchBranchCategories(),
    ])
      .then(([r, c, d, s, p, cat]) => {
        setRoutes(Array.isArray(r) ? r : []);
        setCars(Array.isArray(c) ? c : []);
        setDrivers(Array.isArray(d) ? d : []);
        setSales(Array.isArray(s) ? s : []);
        setProducts(Array.isArray(p) ? p : []);
        setCategories(Array.isArray(cat) ? cat : []);
      })
      .catch((e) => setError(e?.message || 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!routeId) {
      setRouteStops([]);
      setSelectedDcIds(new Set());
      setRetailersByDc({});
      setSelectedRetailerIds(new Set());
      return;
    }
    fetchRouteStops(routeId)
      .then((stops) => setRouteStops(Array.isArray(stops) ? stops : []))
      .catch(() => setRouteStops([]));
    setSelectedDcIds(new Set());
    setSelectedRetailerIds(new Set());
    setRetailersByDc({});
  }, [routeId]);

  useEffect(() => {
    if (includedDcIds.length === 0) {
      setRetailersByDc({});
      return;
    }
    Promise.all(includedDcIds.map((dcId) => fetchRetailersByDc(dcId).then((list) => ({ dcId, list }))))
      .then((results) => {
        const next = {};
        results.forEach(({ dcId, list }) => { next[dcId] = list || []; });
        setRetailersByDc(next);
      })
      .catch(() => setRetailersByDc({}));
  }, [includedDcIds.join(',')]);

  const allRetailers = includedDcIds.flatMap((dcId) => retailersByDc[dcId] || []);
  const selectedRetailers = allRetailers.filter((r) => selectedRetailerIds.has(r.branch_id));

  const toggleDc = (dcBranchId) => {
    setSelectedDcIds((prev) => {
      const next = new Set(prev);
      if (next.has(dcBranchId)) next.delete(dcBranchId);
      else next.add(dcBranchId);
      return next;
    });
  };

  const toggleRetailer = (branchId) => {
    setSelectedRetailerIds((prev) => {
      const next = new Set(prev);
      if (next.has(branchId)) next.delete(branchId);
      else next.add(branchId);
      return next;
    });
  };

  const setQty = useCallback((branchId, productId, qty) => {
    const v = Math.max(0, parseInt(qty, 10) || 0);
    setQuantities((prev) => ({
      ...prev,
      [branchId]: { ...(prev[branchId] || {}), [productId]: v },
    }));
  }, []);

  const getQty = useCallback(
    (branchId, productId) => quantities[branchId]?.[productId] ?? 0,
    [quantities]
  );

  const handleAutoAllocate = useCallback(async () => {
    const branchIds = [...selectedRetailerIds].filter(Boolean);
    if (branchIds.length === 0) {
      setMessage('Select at least one retailer first');
      return;
    }
    setMessage('');
    setAllocating(true);
    try {
      const productIds = products.map((p) => p.product_id).filter(Boolean);
      const allocations = await calculateAllocation(branchIds, productIds, 12);
      setQuantities((prev) => {
        const next = { ...prev };
        allocations.forEach((a) => {
          if (!next[a.branch_id]) next[a.branch_id] = {};
          next[a.branch_id][a.product_id] = a.suggested_qty ?? 0;
        });
        return next;
      });
      setMessage('Quantities filled. Adjust if needed.');
    } catch (e) {
      setMessage(e?.message || 'Allocation failed');
    } finally {
      setAllocating(false);
    }
  }, [selectedRetailerIds, products]);

  const handleSubmit = useCallback(async () => {
    if (!routeId || !carId || !driverId || !salesId) {
      setMessage('Complete Route and Vehicle & Crew.');
      return;
    }
    if (Number(driverId) === Number(salesId)) {
      setMessage('Driver and Sales must be different.');
      return;
    }
    const retailerIds = [...selectedRetailerIds].filter(Boolean);
    if (retailerIds.length === 0) {
      setMessage('Select at least one retailer.');
      return;
    }
    const orders = [];
    for (const branchId of retailerIds) {
      const items = products
        .map((p) => ({ product_id: p.product_id, requested_qty: getQty(branchId, p.product_id) }))
        .filter((i) => (i.requested_qty || 0) > 0);
      if (items.length === 0) continue;
      orders.push({ customer_branch_id: branchId, items });
    }
    if (orders.length === 0) {
      setMessage('Add at least one product quantity per selected retailer.');
      return;
    }
    setMessage('');
    setSaving(true);
    try {
      const dcAssignments = includedDcIds.map((dcId) => ({
        dc_branch_id: dcId,
        local_car_id: null,
        driver_emp_id: null,
        sales_emp_id: null,
      }));
      await createShipment({
        route_id: parseInt(routeId, 10),
        main_car_id: parseInt(carId, 10),
        main_driver_emp_id: parseInt(driverId, 10),
        main_sales_emp_id: parseInt(salesId, 10),
        dc_assignments: dcAssignments,
        orders,
      });
      setMessage('Shipment created.');
      setTimeout(() => navigate('/map'), 1500);
    } catch (e) {
      setMessage(e?.message || e?.body?.error || 'Create failed');
    } finally {
      setSaving(false);
    }
  }, [routeId, carId, driverId, salesId, selectedRetailerIds, includedDcIds, products, getQty, navigate]);

  if (loading) return <div style={{ padding: 24 }}>Loading…</div>;
  if (error) return <div style={{ padding: 24, color: '#b91c1c' }}>{error}</div>;

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: 24 }}>
      <h1 style={{ marginBottom: 8 }}>Create Order</h1>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
        {STEPS.map((label, i) => (
          <button
            key={label}
            type="button"
            onClick={() => setStep(i)}
            style={{
              padding: '8px 12px',
              background: step === i ? '#0ea5e9' : '#e2e8f0',
              color: step === i ? '#fff' : '#334155',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {message && <p style={{ color: step === 5 ? '#059669' : '#b91c1c', marginBottom: 16 }}>{message}</p>}

      {step === 0 && (
        <section>
          <h2>1. Select Route</h2>
          <select
            value={routeId}
            onChange={(e) => setRouteId(e.target.value)}
            style={{ padding: 8, minWidth: 280 }}
          >
            <option value="">-- Choose route --</option>
            {routes.map((r) => (
              <option key={r.route_id} value={r.route_id}>
                {r.name}
              </option>
            ))}
          </select>
        </section>
      )}

      {step === 1 && (
        <section>
          <h2>2. Vehicle & Crew</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <label>
              Car
              <select value={carId} onChange={(e) => setCarId(e.target.value)} style={{ marginLeft: 8, padding: 8 }}>
                <option value="">-- Car --</option>
                {cars.map((c) => (
                  <option key={c.car_id} value={c.car_id}>
                    {c.license_plate} ({c.type_name})
                  </option>
                ))}
              </select>
            </label>
            <label>
              Driver
              <select value={driverId} onChange={(e) => setDriverId(e.target.value)} style={{ marginLeft: 8, padding: 8 }}>
                <option value="">-- Driver --</option>
                {drivers.map((d) => (
                  <option key={d.emp_id} value={d.emp_id}>
                    {d.full_name || `${d.firstname} ${d.lastname}`}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Sales
              <select value={salesId} onChange={(e) => setSalesId(e.target.value)} style={{ marginLeft: 8, padding: 8 }}>
                <option value="">-- Sales --</option>
                {sales.map((s) => (
                  <option key={s.emp_id} value={s.emp_id}>
                    {s.full_name || `${s.firstname} ${s.lastname}`}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>
      )}

      {step === 2 && (
        <section>
          <h2>3. Select DCs (Distribution Centers)</h2>
          <p style={{ color: '#64748b' }}>From route stops (cat = DC)</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {dcsOnRoute.length === 0 && <p>No DCs on this route. Select another route or add stops.</p>}
            {dcsOnRoute.map((d) => (
              <label key={d.branch_id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="checkbox"
                  checked={selectedDcIds.has(d.branch_id)}
                  onChange={() => toggleDc(d.branch_id)}
                />
                {d.branch_name} (branch_id {d.branch_id})
              </label>
            ))}
          </div>
        </section>
      )}

      {step === 3 && (
        <section>
          <h2>4. Select Retailers (Sub-branches)</h2>
          <p style={{ color: '#64748b' }}>Under selected DCs</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {includedDcIds.length === 0 && <p>Select at least one DC in step 3.</p>}
            {includedDcIds.map((dcId) => (
              <div key={dcId}>
                <strong>DC {dcId}</strong>
                {(retailersByDc[dcId] || []).map((r) => (
                  <label key={r.branch_id} style={{ display: 'block', marginLeft: 16, gap: 8 }}>
                    <input
                      type="checkbox"
                      checked={selectedRetailerIds.has(r.branch_id)}
                      onChange={() => toggleRetailer(r.branch_id)}
                    />
                    {r.name || r.branch_name} ({r.branch_id})
                  </label>
                ))}
              </div>
            ))}
          </div>
        </section>
      )}

      {step === 4 && (
        <section>
          <h2>5. Order Items (per retailer)</h2>
          <button
            type="button"
            onClick={handleAutoAllocate}
            disabled={allocating || selectedRetailers.length === 0}
            style={{ marginBottom: 16, padding: '8px 16px', background: '#0ea5e9', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}
          >
            {allocating ? 'Calculating…' : 'Auto-allocate quantities'}
          </button>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                  <th style={{ textAlign: 'left', padding: 8 }}>Branch</th>
                  {products.map((p) => (
                    <th key={p.product_id} style={{ textAlign: 'right', padding: 8 }}>{p.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {selectedRetailers.map((r) => (
                  <tr key={r.branch_id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: 8 }}>{r.name || r.branch_name}</td>
                    {products.map((p) => (
                      <td key={p.product_id} style={{ padding: 8, textAlign: 'right' }}>
                        <input
                          type="number"
                          min={0}
                          value={getQty(r.branch_id, p.product_id)}
                          onChange={(e) => setQty(r.branch_id, p.product_id, e.target.value)}
                          style={{ width: 72, padding: 4 }}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {step === 5 && (
        <section>
          <h2>6. Submit</h2>
          <p>Route: {routes.find((r) => r.route_id === parseInt(routeId, 10))?.name ?? routeId}</p>
          <p>Car: {cars.find((c) => c.car_id === parseInt(carId, 10))?.license_plate ?? carId}</p>
          <p>Driver: {drivers.find((d) => d.emp_id === parseInt(driverId, 10))?.full_name ?? driverId}</p>
          <p>Sales: {sales.find((s) => s.emp_id === parseInt(salesId, 10))?.full_name ?? salesId}</p>
          <p>Retailers: {selectedRetailers.length}</p>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            style={{ padding: '12px 24px', background: '#059669', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}
          >
            {saving ? 'Creating…' : 'Create Shipment'}
          </button>
        </section>
      )}
    </div>
  );
}
