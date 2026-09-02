import React, { useEffect, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { Typography, Card, Table, Button, Tag, Space, Modal, Input, message, Drawer, Select, Tooltip, Switch, Row, Col, Tabs } from "antd";
import { ArrowLeft, ExternalLink, Plus, Edit2, Trash2, Box, RefreshCcw } from "lucide-react";
import { motion } from "framer-motion";

const { Title, Text } = Typography;
const { TextArea } = Input;
const { Option } = Select;

const WordPressProducts = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [saving, setSaving] = useState(false);

  // Form State
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [shortDescription, setShortDescription] = useState("");
  const [regularPrice, setRegularPrice] = useState("");
  const [salePrice, setSalePrice] = useState("");
  const [sku, setSku] = useState("");
  const [manageStock, setManageStock] = useState(false);
  const [stockQuantity, setStockQuantity] = useState(0);
  const [stockStatus, setStockStatus] = useState("instock");
  const [weight, setWeight] = useState("");
  const [length, setLength] = useState("");
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");
  const [status, setStatus] = useState("publish");

  useEffect(() => {
    fetchProducts();
  }, [id]);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/wordpress/${id}/products`, {
        headers: { "Authorization": token ? `Bearer ${token}` : "" }
      });
      const data = await res.json();
      if (data.success) {
        setProducts(data.data);
      } else {
        message.error(data.message || "Failed to fetch products. Is WooCommerce installed?");
      }
    } catch (err) {
      console.error(err);
      message.error("Error fetching products");
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    navigate(location.pathname.replace(/\/products$/, '/dashboard'));
  };

  const openDrawer = (product = null) => {
    if (product) {
      setEditingProduct(product);
      setName(product.name || "");
      setDescription(product.description || "");
      setShortDescription(product.short_description || "");
      setRegularPrice(product.regular_price || "");
      setSalePrice(product.sale_price || "");
      setSku(product.sku || "");
      setManageStock(product.manage_stock || false);
      setStockQuantity(product.stock_quantity || 0);
      setStockStatus(product.stock_status || "instock");
      setWeight(product.weight || "");
      setLength(product.dimensions?.length || "");
      setWidth(product.dimensions?.width || "");
      setHeight(product.dimensions?.height || "");
      setStatus(product.status || "publish");
    } else {
      setEditingProduct(null);
      setName("");
      setDescription("");
      setShortDescription("");
      setRegularPrice("");
      setSalePrice("");
      setSku("");
      setManageStock(false);
      setStockQuantity(0);
      setStockStatus("instock");
      setWeight("");
      setLength("");
      setWidth("");
      setHeight("");
      setStatus("publish");
    }
    setDrawerVisible(true);
  };

  const closeDrawer = () => {
    setDrawerVisible(false);
    setEditingProduct(null);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      message.error("Name is required");
      return;
    }
    
    setSaving(true);
    try {
      const token = localStorage.getItem("token");
      
      const payload = {
        name,
        description,
        short_description: shortDescription,
        regular_price: regularPrice.toString(),
        sale_price: salePrice.toString(),
        sku,
        manage_stock: manageStock,
        stock_quantity: manageStock ? parseInt(stockQuantity || 0) : null,
        stock_status: stockStatus,
        weight: weight.toString(),
        dimensions: {
          length: length.toString(),
          width: width.toString(),
          height: height.toString()
        },
        status
      };
      
      const endpoint = editingProduct 
        ? `/api/wordpress/${id}/products/${editingProduct.id}`
        : `/api/wordpress/${id}/products`;
        
      const method = editingProduct ? "PUT" : "POST";
      
      const res = await fetch(endpoint, {
        method,
        headers: { 
          "Authorization": token ? `Bearer ${token}` : "",
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });
      
      const data = await res.json();
      if (data.success) {
        message.success(`Product ${editingProduct ? 'updated' : 'created'} successfully`);
        closeDrawer();
        fetchProducts();
      } else {
        message.error(data.message || "Failed to save product");
      }
    } catch (err) {
      console.error(err);
      message.error("Error saving product");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (productId) => {
    Modal.confirm({
      title: "Delete Product",
      content: "Are you sure you want to delete this product? This action cannot be undone.",
      okText: "Delete",
      okType: "danger",
      onOk: async () => {
        try {
          const token = localStorage.getItem("token");
          const res = await fetch(`/api/wordpress/${id}/products/${productId}`, {
            method: "DELETE",
            headers: { "Authorization": token ? `Bearer ${token}` : "" }
          });
          const data = await res.json();
          if (data.success) {
            message.success("Product deleted successfully");
            fetchProducts();
          } else {
            message.error(data.message || "Failed to delete product");
          }
        } catch (err) {
          console.error(err);
          message.error("Error deleting product");
        }
      }
    });
  };

  const columns = [
    {
      title: "PRODUCT",
      dataIndex: "name",
      key: "name",
      render: (t, r) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {r.images && r.images.length > 0 ? (
            <img src={r.images[0].src} alt={t} style={{ width: 32, height: 32, borderRadius: 8, objectFit: 'cover' }} />
          ) : (
            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(59, 130, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Box size={16} color="#3b82f6" />
            </div>
          )}
          <Text style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{t}</Text>
        </div>
      )
    },
    {
      title: "PRICE",
      dataIndex: "price",
      key: "price",
      render: (p) => <Text style={{ fontWeight: 600 }}>${p || '0.00'}</Text>
    },
    {
      title: "STATUS",
      dataIndex: "status",
      key: "status",
      render: (t) => (
        <Tag style={{ borderRadius: 12, border: 'none', background: t === 'publish' ? 'rgba(16, 185, 129, 0.1)' : 'var(--bg-secondary)', color: t === 'publish' ? 'var(--accent-success)' : 'var(--text-tertiary)', fontWeight: 800, padding: '2px 10px', textTransform: 'uppercase' }}>
          {t}
        </Tag>
      )
    },
    {
      title: "ACTIONS",
      key: "actions",
      align: "right",
      render: (_, item) => (
        <Space size="middle">
          <Tooltip title="View Product">
            <Button type="text" size="small" icon={<ExternalLink size={16} color="var(--text-secondary)" />} onClick={() => window.open(item.permalink, '_blank')} />
          </Tooltip>
          <Tooltip title="Edit">
            <Button type="text" size="small" icon={<Edit2 size={16} color="var(--accent-primary)" />} onClick={() => openDrawer(item)} />
          </Tooltip>
          <Tooltip title="Delete">
            <Button type="text" size="small" danger icon={<Trash2 size={16} />} onClick={() => handleDelete(item.id)} />
          </Tooltip>
        </Space>
      )
    }
  ];

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, cursor: 'pointer', color: '#0073AA', fontWeight: 700 }} onClick={handleBack}>
        <ArrowLeft size={16} /> Back to Dashboard
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 32 }}>
        <div>
          <Title level={2} style={{ margin: '0 0 8px', color: 'var(--text-primary)', fontWeight: 900 }}>Products</Title>
          <Text type="secondary" style={{ fontSize: 15, fontWeight: 500 }}>Manage WooCommerce products synchronized with your remote installation.</Text>
        </div>
        
        <Space>
          <Button size="large" icon={<RefreshCcw size={16} />} onClick={fetchProducts} loading={loading} style={{ borderRadius: 8, fontWeight: 700, borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}>
            Sync
          </Button>
          <Button size="large" type="primary" icon={<Plus size={16} />} onClick={() => openDrawer()} style={{ borderRadius: 8, fontWeight: 800, border: 'none' }}>
            New Product
          </Button>
        </Space>
      </div>

      <Card bodyStyle={{ padding: 0 }} style={{ borderRadius: 12, border: '1px solid var(--border-color)', overflow: 'hidden' }}>
        <Table 
          dataSource={products} 
          columns={columns} 
          rowKey="id"
          pagination={{
            defaultPageSize: 10, showSizeChanger: true, pageSizeOptions: ['10', '20', '50', '100', '200'],
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50', '100'],
            showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} items`,
            position: ['bottomCenter']
          }}
          loading={loading}
        />
      </Card>

      <Drawer
        title={<div style={{ fontSize: 18, fontWeight: 900 }}>{editingProduct ? 'Edit Product' : 'Create Product'}</div>}
        width={600}
        onClose={closeDrawer}
        open={drawerVisible}
        bodyStyle={{ paddingBottom: 80, background: 'var(--bg-primary)' }}
        extra={
          <Space>
            <Button onClick={closeDrawer} style={{ borderRadius: 8, fontWeight: 700 }}>Cancel</Button>
            <Button onClick={handleSave} type="primary" loading={saving} style={{ background: '#0073AA', border: 'none', borderRadius: 8, fontWeight: 800 }}>
              {editingProduct ? 'Update Product' : 'Publish Product'}
            </Button>
          </Space>
        }
      >
        <Tabs defaultActiveKey="1" style={{ marginTop: 24 }}>
          <Tabs.TabPane tab="General" key="1">
            <div style={{ marginBottom: 24, marginTop: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: "var(--text-tertiary)", letterSpacing: 0.5, marginBottom: 8 }}>PRODUCT NAME <span style={{ color: "var(--accent-danger)" }}>*</span></div>
              <Input 
                size="large"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Vintage T-Shirt"
                style={{ borderRadius: 8, fontWeight: 600, fontSize: 16 }}
              />
            </div>

            <Row gutter={16}>
              <Col span={12}>
                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: "var(--text-tertiary)", letterSpacing: 0.5, marginBottom: 8 }}>REGULAR PRICE ($)</div>
                  <Input 
                    size="large"
                    type="number"
                    value={regularPrice}
                    onChange={(e) => setRegularPrice(e.target.value)}
                    placeholder="e.g. 29.99"
                    style={{ borderRadius: 8, fontWeight: 600, fontSize: 16 }}
                  />
                </div>
              </Col>
              <Col span={12}>
                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: "var(--text-tertiary)", letterSpacing: 0.5, marginBottom: 8 }}>SALE PRICE ($)</div>
                  <Input 
                    size="large"
                    type="number"
                    value={salePrice}
                    onChange={(e) => setSalePrice(e.target.value)}
                    placeholder="e.g. 19.99"
                    style={{ borderRadius: 8, fontWeight: 600, fontSize: 16 }}
                  />
                </div>
              </Col>
            </Row>

            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: "var(--text-tertiary)", letterSpacing: 0.5, marginBottom: 8 }}>STATUS</div>
              <Select size="large" value={status} onChange={setStatus} style={{ width: '100%' }} dropdownStyle={{ borderRadius: 8 }}>
                <Option value="publish">Published</Option>
                <Option value="draft">Draft</Option>
                <Option value="pending">Pending Review</Option>
              </Select>
            </div>
          </Tabs.TabPane>

          <Tabs.TabPane tab="Inventory" key="2">
            <div style={{ marginBottom: 24, marginTop: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: "var(--text-tertiary)", letterSpacing: 0.5, marginBottom: 8 }}>SKU (Stock Keeping Unit)</div>
              <Input 
                size="large"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                placeholder="e.g. VINTAGE-TSHIRT-001"
                style={{ borderRadius: 8, fontWeight: 600, fontSize: 16 }}
              />
            </div>

            <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
              <Switch checked={manageStock} onChange={setManageStock} />
              <span style={{ fontSize: 14, fontWeight: 600 }}>Manage stock level (quantity)</span>
            </div>

            {manageStock ? (
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: "var(--text-tertiary)", letterSpacing: 0.5, marginBottom: 8 }}>STOCK QUANTITY</div>
                <Input 
                  size="large"
                  type="number"
                  value={stockQuantity}
                  onChange={(e) => setStockQuantity(e.target.value)}
                  placeholder="0"
                  style={{ borderRadius: 8, fontWeight: 600, fontSize: 16 }}
                />
              </div>
            ) : (
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: "var(--text-tertiary)", letterSpacing: 0.5, marginBottom: 8 }}>STOCK STATUS</div>
                <Select size="large" value={stockStatus} onChange={setStockStatus} style={{ width: '100%' }} dropdownStyle={{ borderRadius: 8 }}>
                  <Option value="instock">In Stock</Option>
                  <Option value="outofstock">Out of Stock</Option>
                  <Option value="onbackorder">On Backorder</Option>
                </Select>
              </div>
            )}
          </Tabs.TabPane>

          <Tabs.TabPane tab="Shipping" key="3">
            <div style={{ marginBottom: 24, marginTop: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: "var(--text-tertiary)", letterSpacing: 0.5, marginBottom: 8 }}>WEIGHT (kg)</div>
              <Input 
                size="large"
                type="number"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                placeholder="0.0"
                style={{ borderRadius: 8, fontWeight: 600, fontSize: 16 }}
              />
            </div>

            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: "var(--text-tertiary)", letterSpacing: 0.5, marginBottom: 8 }}>DIMENSIONS (cm)</div>
              <Row gutter={8}>
                <Col span={8}>
                  <Input size="large" type="number" placeholder="Length" value={length} onChange={(e) => setLength(e.target.value)} />
                </Col>
                <Col span={8}>
                  <Input size="large" type="number" placeholder="Width" value={width} onChange={(e) => setWidth(e.target.value)} />
                </Col>
                <Col span={8}>
                  <Input size="large" type="number" placeholder="Height" value={height} onChange={(e) => setHeight(e.target.value)} />
                </Col>
              </Row>
            </div>
          </Tabs.TabPane>

          <Tabs.TabPane tab="Descriptions" key="4">
            <div style={{ marginBottom: 24, marginTop: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: "var(--text-tertiary)", letterSpacing: 0.5, marginBottom: 8 }}>SHORT DESCRIPTION (HTML SUPPORTED)</div>
              <TextArea
                rows={4}
                value={shortDescription}
                onChange={(e) => setShortDescription(e.target.value)}
                placeholder="<p>Quick summary of your product...</p>"
                style={{ borderRadius: 8, fontFamily: 'monospace', fontSize: 13, background: 'var(--bg-secondary)' }}
              />
            </div>

            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: "var(--text-tertiary)", letterSpacing: 0.5, marginBottom: 8 }}>MAIN DESCRIPTION (HTML SUPPORTED)</div>
              <TextArea
                rows={10}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="<p>Full detailed description of your product here...</p>"
                style={{ borderRadius: 8, fontFamily: 'monospace', fontSize: 13, background: 'var(--bg-secondary)' }}
              />
            </div>
          </Tabs.TabPane>
        </Tabs>
      </Drawer>
    </div>
  );
};

export default WordPressProducts;
