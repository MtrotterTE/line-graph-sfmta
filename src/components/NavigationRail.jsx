function NavigationRail({ activeView, onSelectView }) {
    const sections = [
        {
            title: 'Distance vs Time',
            options: [
                { id: 'outboundTime', label: 'K Line Outbound' },
                { id: 'inboundTime', label: 'K Line Inbound' },
            ],
        },
        {
            title: 'Distance vs Speed',
            options: [
                { id: 'outboundSpeed', label: 'K Line Outbound' },
                { id: 'inboundSpeed', label: 'K Line Inbound' },
            ],
        },
    ]

    const handleSelect = (view) => {
        if (typeof onSelectView === 'function') {
            onSelectView(view)
        }
    }

    return (
        <div className="rail navigation-rail pa-4">
            <div className="nav-buttons">
                <h1>Choose a Graph:</h1>
                {sections.map((section) => (
                    <div key={section.title}>
                        <h2>{section.title}</h2>
                        {section.options.map((option) => (
                            <button
                                key={option.id}
                                type="button"
                                className={`v-btn${activeView === option.id ? ' active' : ''}`}
                                onClick={() => handleSelect(option.id)}
                            >
                                {option.label}
                            </button>
                        ))}
                    </div>
                ))}
            </div>
        </div>
    )
}

export default NavigationRail
